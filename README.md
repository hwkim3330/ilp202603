# TSN/GCL Solver & Debugger

IEEE 802.1Qbv Time-Aware Shaper (TAS) 기반 GCL (Gate Control List) 스케줄링 솔버 및 시각적 디버거.

자동차 센서 네트워크 (LiDAR, Radar) 토폴로지에서 TSN 스케줄링을 Greedy/ILP로 풀고,
D3.js 기반 시각화로 알고리즘 내부를 한 줄씩 추적합니다.

## Quick Start

정적 웹 페이지입니다. 서버 불필요 — 파일을 열거나 HTTP 서버로 실행:

```bash
python3 -m http.server 8080 -d /home/kim/ilp202603
# → http://localhost:8080
```

- **`index.html`** — 랜딩 페이지 (모델 개요, 디버거 링크)
- **`roii-debug.html`** — 함수 디버거 (Step-by-step 실행, Gantt 차트, 변수 인스펙터)

## Architecture

```
index.html                     ← 랜딩 페이지
roii-debug.html                ← 함수 디버거 UI
js/
├── ilp-core.js                ← 핵심 솔버 엔진 (5개 알고리즘)
├── roii-real-data.js          ← 네트워크 모델 정의 (7개 모델)
├── debug-controller.js        ← 디버거 컨트롤러 (Step/Play/FF)
├── debug-renderers.js         ← Gantt, 토폴로지, 타임라인 렌더러
├── debug-utils.js             ← 공통 유틸리티, 모델 설정 맵
├── debug-source-code.js       ← 소스 코드 표시용 라인 데이터
└── instruments/               ← 각 함수의 instrumented 버전
    ├── index.js
    ├── generate-k-paths.js
    ├── expand-packets.js
    ├── solve-greedy.js
    ├── solve-ilp.js
    └── build-result.js
vendor/
├── d3.min.js                  ← D3.js v7
└── glpk.js                    ← GLPK/WASM (ILP 솔버)
```

## Algorithms

### 1. `generateKPaths(adj, src, dst, k, maxD)`

DFS 기반 k-shortest path 탐색.

- **입력**: 인접 리스트, 출발/도착 노드, 최대 경로 수 k, 최대 깊이
- **출력**: 최단 경로부터 k개의 후보 경로 (link ID 배열)
- **복잡도**: O(V! / (V-maxD)!) worst case, 실제 네트워크에서 매우 빠름

### 2. `expandPackets(model)`

플로우 정의 → 개별 패킷 인스턴스 확장.

- `cycle_time_us / period_us` = 사이클당 패킷 수 (정수 필수)
- 각 패킷: `pid`, `fid`, `pri` (PCP), `rel` (release time), `dl` (absolute deadline)
- k-shortest paths로 후보 경로 자동 생성
- TX time = `(payload_bytes + 38) × 8 / rate_mbps` [µs]
  - +38 bytes: Ethernet header(14) + FCS(4) + Preamble(8) + IFG(12)

### 3. `computeGateSchedule(model, pkts)` — IEEE 802.1Qbv

**핵심 알고리즘.** 각 스위치 이그레스 포트에 대한 GCL을 생성합니다.

#### 서브피리어드 기반 게이트 스케줄링

서로 다른 주기의 플로우가 공존할 때 (예: LiDAR 10ms + Radar 5ms → 사이클 10ms),
사이클을 서브피리어드 (GCD of all flow periods)로 분할하여 각 서브피리어드 내에
독립적인 TC 윈도우를 할당합니다.

```
예시: cycle=10000µs, LiDAR period=10000µs, Radar period=5000µs
서브피리어드 = GCD(10000, 5000) = 5000µs → 2개 서브피리어드

서브피리어드 0 [0, 5000):
  TC6 (Radar, deadline=2000µs)  ← EDF: 타이트한 데드라인 먼저
  Guard Band (12.3µs)
  TC7 (LiDAR, deadline=5000µs)
  Guard Band (12.3µs)
  BE (remaining)

서브피리어드 1 [5000, 10000):
  TC6 (Radar only)              ← LiDAR는 이 서브피리어드에 패킷 없음
  Guard Band (12.3µs)
  BE (remaining)
```

#### EDF (Earliest Deadline First) 게이트 윈도우 배치

TC 윈도우 배치 순서는 PCP 번호가 아닌 **데드라인 타이트함** 기준:
- TC6 (Radar, deadline=2000µs) → 먼저 배치
- TC7 (LiDAR, deadline=5000µs) → 나중 배치

이렇게 해야 타이트한 데드라인의 패킷이 게이트 대기 없이 빠르게 전송됩니다.

#### 비례 할당

각 서브피리어드 내에서 TC별 윈도우 크기는 TX 수요에 비례하여 할당:
```
allocation[tc] = max(
  (tcTxNeed / totalTxNeed) × availableTime,
  maxSinglePacketTx + 1µs   ← 최소 보장
)
```

#### Guard Band

IEEE 802.1Qbv 표준에 따라 TC 전환 시 모든 게이트를 닫는 guard band 삽입:
```
guard_band_us = 12.304µs = (1500 + 38) × 8 / 1000
```
이는 1500B MTU의 worst-case in-flight 프레임 전송 시간입니다.

#### Gate Mask (8-bit)

```
Bit 7 (MSB) = TC7, Bit 0 (LSB) = TC0
"10000000" = TC7 only open
"01000000" = TC6 only open
"00000000" = all closed (guard band)
"11111111" = all open (best-effort)
```

### 4. `solveGreedy(model)` — Priority-Based List Scheduler

Greedy 스케줄러. O(P × R × H × O) where P=packets, R=routes, H=hops, O=occupancy entries.

#### 알고리즘 흐름

```
1. expandPackets → 패킷 인스턴스 생성
2. computeGateSchedule → 링크별 게이트 윈도우 계산
3. 패킷을 PCP 내림차순 → release time 오름차순 → deadline 오름차순 정렬
4. 각 패킷에 대해:
   a. 모든 후보 경로 시도
   b. 각 홉에서 findEarliest(lid, earliest, duration, pktTC) 호출
   c. 가장 빠른 종료 시간의 경로 선택
   d. 선택된 경로의 각 링크에 점유 구간 등록
5. buildResult → GCL 생성 + 결과 조합
```

#### `findEarliest(lid, earliest, duration, pktTC)` — 이중 제약 탐색

```
반복 (최대 10000회):
  1. 게이트 제약: pktTC에 해당하는 TC 윈도우 중
     - t가 윈도우 내 → 진행
     - t가 윈도우 전 → t = window.open으로 점프
     - 어떤 윈도우에도 안 맞으면 → Infinity (불가)
  2. 점유 제약: 기존 패킷과 겹치면 t = 기존 패킷 end로 밀림
  3. 겹침 없으면 → 확정, (t, queue) 반환
  4. 밀렸으면 → 1로 돌아가 게이트 재확인
```

### 5. `solveILP(model, glpk)` — GLPK/WASM 정수 선형 프로그래밍

정확한 최적해. GLPK v5.0 WASM 바인딩 사용.

#### 두 가지 정식화

**Fixed-route (모든 패킷 경로 1개)**: z-변수 불필요, per-pair tight M으로 빠른 LP relaxation

```
변수: s_{p,h} (패킷 p의 홉 h 시작 시간)
제약:
  - 하한: s_{p,h} ≥ earliest_arrival
  - 상한: s_{p,h} ≤ latest_start (deadline 기반)
  - 체인: s_{p,h+1} ≥ s_{p,h} + tx + pd + processing_delay
  - 데드라인: s_{p,last} ≤ dl - tx - pd
  - 비겹침: pairwise ordering (tight M per pair, window pruning)
목적함수: min Σ s_{p,last} (TSN 패킷의 최종 홉 시작 시간 합)
```

**Multi-route (k-paths)**: Big-M with z-variables

```
추가 변수: z_{p,r} ∈ {0,1} (패킷 p가 경로 r 사용 여부)
추가 제약: Σ_r z_{p,r} = 1 (각 패킷은 정확히 1 경로)
```

### 6. `buildResult(model, pkts, schedHops, method, stats)` — GCL 생성

스케줄된 패킷 위치 → IEEE 802.1Qbv GCL 변환.

- **Guard band**: `gate_mask = "00000000"`, `note = "guard"`
- **TC window with packets**: `gate_mask = TC-specific mask`, `note = packet_id`
- **TC window empty**: `gate_mask = TC-specific mask`, `note = "non-ST"`
- **BE window**: `gate_mask = "11111111"`, `note = "non-ST"`
- **worstUtil**: guard band와 non-ST 제외한 활성 전송 시간 / cycle_time

## Network Models

### Standard (ROII_REAL_STANDARD)

```
13 nodes | 16 links | 9 flows | 14 pkts/cycle | 10ms cycle
```

LAN9692 삼각형 백본 (SW_FL ↔ SW_FR ↔ SW_REAR).
모든 플로우가 SW_REAR → ACU_IT 단일 게이트웨이 경유.

| Sensor | Type | Payload | Period | PCP | TX time |
|--------|------|---------|--------|-----|---------|
| AutoL G32 ×2 | LiDAR | 128 KB | 10ms | 7 | 1048.9µs |
| Hesai Pandar ×2 | LiDAR | 32 KB | 10ms | 7 | 262.4µs |
| MRR-35 ×5 | Radar | 4 KB | 5ms (2 pkts/cycle) | 6 | 33.1µs |

Bottleneck: SW_REAR → ACU_IT (~29.5% utilization)

### Optimal Tri-Star (ROII_OPTIMAL)

Standard와 동일 센서/플로우, 단 **각 스위치가 ACU_IT에 직접 연결**.
모든 플로우 2-hop. Worst util ~14.4%, E2E ~50% 감소.

### HW Direct (ROII_HW_DIRECT)

4 LiDAR만 Ethernet 직결. Radar는 CAN-FD (비Ethernet). 스위치 없음. 4 flows.

### HW 1G (ROII_HW_1G)

LiDAR 4 + Radar 6 (CAN2ETH 변환) → 3 zone switches. 모든 링크 1 Gbps.

### HW 10G (ROII_HW_10G)

HW 1G과 동일하지만 SW_REAR → ACU_IT가 10GBASE-T1 (10 Gbps).
게이트웨이 병목 해소, utilization 31.7% → 10.6%.

## Function Debugger

`roii-debug.html`에서 5개 함수를 한 줄씩 Step 실행:

| Function | Description | Steps |
|----------|-------------|-------|
| `generateKPaths` | k-shortest path DFS 탐색 | DFS 재귀, 경로 발견, 정렬 |
| `expandPackets` | 플로우 → 패킷 확장 | PCP/release/deadline 계산 |
| `solveGreedy` | 802.1Qbv TAS 스케줄러 | 게이트 윈도우 탐색, 점유 충돌 해결 |
| `solveILP` | GLPK/WASM ILP 최적화 | 변수/제약 생성, LP relaxation |
| `buildResult` | GCL 생성 + 결과 조합 | 게이트 엔트리, 유틸리티 계산 |

시각화 패널:
- **Source Code**: 현재 실행 줄 하이라이트
- **Variable Inspector**: 변수 값 실시간 추적 (변경 강조)
- **Gantt Chart**: 패킷 배치 애니메이션, guard band hatched 표시
- **Topology**: D3.js force graph, 8-queue gate mask 시각화
- **Packet Timeline**: 플로우별 release/deadline Gantt

## Data Structures

### Packet (`pkts[i]`)
```javascript
{
  pid: "f_lidar_fc#0",  // flow_id + instance
  fid: "f_lidar_fc",    // flow ID
  pri: 7,               // PCP (Traffic Class)
  rel: 0,               // release time [µs]
  dl: 5000,             // absolute deadline [µs] (null if non-TSN)
  tsn: true,            // has deadline?
  routes: [{            // candidate routes
    ri: 0,
    hops: [{ lid: "l_lidarfc_swfl", tx: 1048.88, pd: 0.5 }, ...]
  }, ...]
}
```

### Gate Schedule Entry
```javascript
{
  queue: 6,       // TC number (-1 for guard)
  open: 0.0,      // window start [µs]
  close: 295.1,   // window end [µs]
  type: "tc"      // "tc" | "guard" | "be"
}
```

### GCL Entry (output)
```javascript
{
  index: 0,
  gate_mask: "01000000",  // TC6 open
  start_us: 0.0,
  end_us: 33.072,
  duration_us: 33.072,
  note: "f_radar_f#0"     // packet ID or "guard" or "non-ST"
}
```

### Result
```javascript
{
  method: "Greedy (802.1Qbv TAS scheduler)",
  objective: 10680.214,          // total TSN E2E delay [µs]
  worst_util_percent: 29.534,    // worst link utilization [%]
  packetRows: [...],             // per-packet scheduling results
  gcl: { cycle_time_us, base_time_us, links: { ... } },
  stats: { overlap_conflicts, fallback_packets, runtime_ms, ... }
}
```

## Key Design Decisions

1. **EDF Gate Ordering**: TC 윈도우를 PCP가 아닌 데드라인 타이트함으로 정렬. PCP는 non-TAS 환경의 strict priority용이며, TAS에서는 게이트 타이밍이 우선순위를 제어합니다.

2. **Sub-period Gate Schedule**: `period < cycle_time`인 플로우를 위해 사이클을 GCD 서브피리어드로 분할. 각 서브피리어드에 독립적 TC 윈도우 할당.

3. **Worst-case TC Window Sizing**: 게이트 스케줄은 라우트 선택 전에 계산되므로, 각 패킷이 해당 링크를 사용할 가능성이 있는 모든 경우를 고려 (보수적 할당).

4. **Guard Band = MTU-based**: 12.304µs = 1500B Ethernet MTU의 worst-case 전송 시간. 센서 페이로드가 MTU보다 크더라도, guard band는 게이트 전환 시 in-flight 프레임 기준.

## Dependencies

- [D3.js v7](https://d3js.org/) — 토폴로지, Gantt, 차트 시각화
- [GLPK.js](https://github.com/jvail/glpk.js) — WASM ILP 솔버

순수 클라이언트 사이드. 서버, 빌드 도구, npm 불필요.

## References

- IEEE 802.1Qbv-2015 — Enhancements for Scheduled Traffic (TAS)
- IEEE 802.1Q-2022 — Bridges and Bridged Networks
- Microchip LAN9692 — Automotive TSN Switch

---

KETI — TSN/GCL Solver Debugger &copy; 2025-2026
