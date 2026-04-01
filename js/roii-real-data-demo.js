/* ═══════════════════════════════════════════════
   roii-real-data.js — ROii Realistic Sensor Model
   All 1000BASE-T1 (1 Gbps) links
   ═══════════════════════════════════════════════ */

/* ── Shared Topology ────────────────────────────── */
const NODES = [
  // LiDAR sensors (4)
  { id: "LIDAR_FC", type: "endstation" },  // AutoL G32
  { id: "LIDAR_FL", type: "endstation" },  // Hesai Pandar 40P
  { id: "LIDAR_FR", type: "endstation" },  // Hesai Pandar 40P
  { id: "LIDAR_R",  type: "endstation" },  // AutoL G32
  // Radar sensors (5) — Continental MRR-35
  { id: "RADAR_F",   type: "endstation" },
  { id: "RADAR_FLC", type: "endstation" },
  { id: "RADAR_FRC", type: "endstation" },
  { id: "RADAR_RLC", type: "endstation" },
  { id: "RADAR_RRC", type: "endstation" },
  // Switches — LAN9692 triangle topology
  { id: "SW_FL",   type: "switch" },
  { id: "SW_FR",   type: "switch" },
  { id: "SW_REAR", type: "switch" },
  // Background traffic source
  { id: "BG",     type: "endstation" },
  // Processing unit
  { id: "ACU_IT",  type: "endstation" }
];

const LINKS = [
  // LiDAR → switches (all 1 Gbps)
  { id: "l_lidarfc_swfl",   from: "LIDAR_FC",  to: "SW_FL",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_lidarfl_swfl",   from: "LIDAR_FL",  to: "SW_FL",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_lidarfr_swfr",   from: "LIDAR_FR",  to: "SW_FR",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_lidarr_swrear",  from: "LIDAR_R",   to: "SW_REAR", rate_mbps: 1000, prop_delay_us: 0.5 },
  // Radar → switches (all 1 Gbps)
  { id: "l_radarf_swfl",    from: "RADAR_F",   to: "SW_FL",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_radarflc_swfl",  from: "RADAR_FLC", to: "SW_FL",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_radarfrc_swfr",  from: "RADAR_FRC", to: "SW_FR",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_radarrlc_swrear",from: "RADAR_RLC", to: "SW_REAR", rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_radarrrc_swrear",from: "RADAR_RRC", to: "SW_REAR", rate_mbps: 1000, prop_delay_us: 0.5 },
  // Triangle switch backbone (1 Gbps bidirectional)
  { id: "l_swfl_swfr",    from: "SW_FL",   to: "SW_FR",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_swfr_swfl",    from: "SW_FR",   to: "SW_FL",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_swfl_swrear",  from: "SW_FL",   to: "SW_REAR", rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_swrear_swfl",  from: "SW_REAR", to: "SW_FL",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_swfr_swrear",  from: "SW_FR",   to: "SW_REAR", rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_swrear_swfr",  from: "SW_REAR", to: "SW_FR",   rate_mbps: 1000, prop_delay_us: 0.5 },
  // Background → all switches
  { id: "l_bg_swfl",      from: "BG",      to: "SW_FL",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_bg_swfr",      from: "BG",      to: "SW_FR",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_bg_swrear",    from: "BG",      to: "SW_REAR", rate_mbps: 1000, prop_delay_us: 0.5 },
  // Gateway → Processing
  { id: "l_swrear_acu",   from: "SW_REAR", to: "ACU_IT",  rate_mbps: 1000, prop_delay_us: 0.3 }
];

/* ── Standard Model (10ms = GCD(50ms, 20ms)) ─────────── */
export const ROII_REAL_STANDARD = {
  cycle_time_us: 10000,
  guard_band_us: 12.304,
  processing_delay_us: 3,
  nodes: JSON.parse(JSON.stringify(NODES)),
  links: JSON.parse(JSON.stringify(LINKS)),
  flows: [
    // LiDAR flows (PCP 7 → TC7) — G32: 128KB point cloud burst, Pandar: 32KB sub-sampled
    { id: "f_lidar_fc", PCP: 7, payload_bytes: 131072, period_us: 10000, deadline_us: 5000,
      traffic_type: "lidar", src: "LIDAR_FC", dst: "ACU_IT", k_paths: 2 },
    { id: "f_lidar_fl", PCP: 7, payload_bytes: 32768, period_us: 10000, deadline_us: 5000,
      traffic_type: "lidar", src: "LIDAR_FL", dst: "ACU_IT", k_paths: 2 },
    { id: "f_lidar_fr", PCP: 7, payload_bytes: 32768, period_us: 10000, deadline_us: 5000,
      traffic_type: "lidar", src: "LIDAR_FR", dst: "ACU_IT", k_paths: 2 },
    { id: "f_lidar_r",  PCP: 7, payload_bytes: 131072, period_us: 10000, deadline_us: 5000,
      traffic_type: "lidar", src: "LIDAR_R",  dst: "ACU_IT", k_paths: 2 },
    // Radar flows (PCP 6 → TC6) — MRR-35: 4KB detection data, 50Hz (2 pkts per 10ms cycle)
    { id: "f_radar_f",   PCP: 6, payload_bytes: 4096, period_us: 5000, deadline_us: 2000,
      traffic_type: "radar", src: "RADAR_F",   dst: "ACU_IT", k_paths: 2 },
    { id: "f_radar_flc", PCP: 6, payload_bytes: 4096, period_us: 5000, deadline_us: 2000,
      traffic_type: "radar", src: "RADAR_FLC", dst: "ACU_IT", k_paths: 2 },
    { id: "f_radar_frc", PCP: 6, payload_bytes: 4096, period_us: 5000, deadline_us: 2000,
      traffic_type: "radar", src: "RADAR_FRC", dst: "ACU_IT", k_paths: 2 },
    { id: "f_radar_rlc", PCP: 6, payload_bytes: 4096, period_us: 5000, deadline_us: 2000,
      traffic_type: "radar", src: "RADAR_RLC", dst: "ACU_IT", k_paths: 2 },
    { id: "f_radar_rrc", PCP: 6, payload_bytes: 4096, period_us: 5000, deadline_us: 2000,
      traffic_type: "radar", src: "RADAR_RRC", dst: "ACU_IT", k_paths: 2 }
  ]
};

/* ── Fixed Node Positions (vehicle top-down layout) ── */
export function getRealPositions(W, H) {
  return {
    // Top row — front sensors evenly spaced
    RADAR_FLC: { x: W * 0.04, y: H * 0.06 },
    LIDAR_FL:  { x: W * 0.20, y: H * 0.06 },
    LIDAR_FC:  { x: W * 0.36, y: H * 0.06 },
    RADAR_F:   { x: W * 0.50, y: H * 0.06 },
    LIDAR_FR:  { x: W * 0.64, y: H * 0.06 },
    RADAR_FRC: { x: W * 0.80, y: H * 0.06 },
    // Upper-middle — front zone controllers (symmetric)
    SW_FL:     { x: W * 0.25, y: H * 0.34 },
    SW_FR:     { x: W * 0.75, y: H * 0.34 },
    // Center of triangle backbone — background traffic
    BG:        { x: W * 0.50, y: H * 0.42 },
    // Lower-middle — rear sensors + gateway
    RADAR_RLC: { x: W * 0.08, y: H * 0.60 },
    SW_REAR:   { x: W * 0.50, y: H * 0.58 },
    RADAR_RRC: { x: W * 0.92, y: H * 0.60 },
    LIDAR_R:   { x: W * 0.50, y: H * 0.78 },
    // Bottom — ACU-IT
    ACU_IT:    { x: W * 0.50, y: H * 0.92 }
  };
}

/* ── Node Color Map ──────────────────────────── */
export const ROII_REAL_NODE_COLORS = {
  // LiDAR G32 — bright green
  LIDAR_FC:  { fill: "#d1fae5", stroke: "#10B981", label: "G32 FC",       shortLabel: "G32" },
  LIDAR_R:   { fill: "#d1fae5", stroke: "#10B981", label: "G32 Rear",     shortLabel: "G32" },
  // LiDAR Pandar 40P — teal green
  LIDAR_FL:  { fill: "#ccfbf1", stroke: "#0D9488", label: "Pandar FL",    shortLabel: "P40P" },
  LIDAR_FR:  { fill: "#ccfbf1", stroke: "#0D9488", label: "Pandar FR",    shortLabel: "P40P" },
  // Radar MRR-35 — purple
  RADAR_F:   { fill: "#ede9fe", stroke: "#952aff", label: "MRR-35 F",     shortLabel: "MRR" },
  RADAR_FLC: { fill: "#ede9fe", stroke: "#952aff", label: "MRR-35 FLC",   shortLabel: "MRR" },
  RADAR_FRC: { fill: "#ede9fe", stroke: "#952aff", label: "MRR-35 FRC",   shortLabel: "MRR" },
  RADAR_RLC: { fill: "#ede9fe", stroke: "#952aff", label: "MRR-35 RLC",   shortLabel: "MRR" },
  RADAR_RRC: { fill: "#ede9fe", stroke: "#952aff", label: "MRR-35 RRC",   shortLabel: "MRR" },
  // Switches — blue
  SW_FL:     { fill: "#dbeafe", stroke: "#3B82F6", label: "Front-L ZC",   shortLabel: "LAN9692" },
  SW_FR:     { fill: "#dbeafe", stroke: "#3B82F6", label: "Front-R ZC",   shortLabel: "LAN9692" },
  SW_REAR:   { fill: "#cffafe", stroke: "#06B6D4", label: "Rear GW",      shortLabel: "LAN9692" },
  // Background — light pink
  BG:        { fill: "#fce7f3", stroke: "#ec4899", label: "BG Traffic",    shortLabel: "BG" },
  // ACU-IT — red
  ACU_IT:    { fill: "#fee2e2", stroke: "#dc2626", label: "ACU-IT",       shortLabel: "ECU" }
};

/* ── Switch Definitions ──────────────────────── */
export const ROII_REAL_SWITCHES = [
  { id: "SW_FL",   label: "Front-Left ZC (LAN9692)",  chip: "LAN9692", color: "#3B82F6" },
  { id: "SW_FR",   label: "Front-Right ZC (LAN9692)", chip: "LAN9692", color: "#3B82F6" },
  { id: "SW_REAR", label: "Rear Gateway (LAN9692)",   chip: "LAN9692", color: "#06B6D4" }
];

/* ── Flow Color Function ─────────────────────── */
export function realFlowColor(fid) {
  const id = (fid || '').toLowerCase();
  if (id.includes('lidar')) return '#10B981';
  if (id.includes('radar')) return '#952aff';
  return '#3B82F6';
}

/* ── Scenario Descriptions ───────────────────── */
export const ROII_REAL_STANDARD_SCENARIO = {
  title: "ROii Realistic \u2014 Standard 10ms Cycle",
  description: "Realistic ROii shuttle sensor network. All links 1 Gbps. AutoL G32 sends 128KB point cloud burst (1048.9\u00b5s tx), Hesai Pandar 40P sends 32KB sub-sampled data (262.4\u00b5s tx), Continental MRR-35 sends 4KB detection data at 50Hz (2 pkts/cycle, 33.1\u00b5s tx each). <strong>9 flows, 14 pkts/cycle</strong>. Bottleneck utilization \u2248 30%.",
  flows: [
    { name: "G32 FC \u2192 ACU-IT",      color: "#10B981", desc: "128KB point cloud, P7, 1Gbps (1048.9\u00b5s tx)" },
    { name: "Pandar FL \u2192 ACU-IT",   color: "#0D9488", desc: "32KB sub-sampled, P7, 1Gbps (262.4\u00b5s tx)" },
    { name: "Pandar FR \u2192 ACU-IT",   color: "#0D9488", desc: "32KB sub-sampled, P7, 1Gbps (262.4\u00b5s tx)" },
    { name: "G32 Rear \u2192 ACU-IT",    color: "#10B981", desc: "128KB point cloud, P7, 1Gbps (1048.9\u00b5s tx)" },
    { name: "MRR-35 F \u2192 ACU-IT",    color: "#952aff", desc: "4KB \u00d72pkts, P6, 50Hz (33.1\u00b5s tx)" },
    { name: "MRR-35 FLC \u2192 ACU-IT",  color: "#952aff", desc: "4KB \u00d72pkts, P6, 50Hz (33.1\u00b5s tx)" },
    { name: "MRR-35 FRC \u2192 ACU-IT",  color: "#952aff", desc: "4KB \u00d72pkts, P6, 50Hz (33.1\u00b5s tx)" },
    { name: "MRR-35 RLC \u2192 ACU-IT",  color: "#952aff", desc: "4KB \u00d72pkts, P6, 50Hz (33.1\u00b5s tx)" },
    { name: "MRR-35 RRC \u2192 ACU-IT",  color: "#952aff", desc: "4KB \u00d72pkts, P6, 50Hz (33.1\u00b5s tx)" }
  ],
  domains: [
    { name: "LiDAR G32 (1Gbps)",       color: "#10B981" },
    { name: "LiDAR Pandar 40P (1Gbps)", color: "#0D9488" },
    { name: "Radar MRR-35 (1Gbps)",    color: "#952aff" },
    { name: "LAN9692 Backbone",        color: "#3B82F6" },
    { name: "ACU-IT Processing",       color: "#dc2626" }
  ]
};

/* ═══════════════════════════════════════════════════
   3D Visualization Data (standard 13-node topology)
   ═══════════════════════════════════════════════════ */

/* ── 3D Positions (mapped from vehicle geometry) ── */
export const ROII_REAL_3D_POSITIONS = {
  LIDAR_FC:   { x:  0,    y: 5.5,  z: 18.5 },
  LIDAR_FL:   { x: -8.5,  y: 10,   z: 16.2 },
  LIDAR_FR:   { x:  8.5,  y: 10,   z: 16.2 },
  LIDAR_R:    { x:  0,    y: 5.5,  z:-18.5 },
  RADAR_F:    { x:  0,    y: 7,    z: 18.5 },
  RADAR_FLC:  { x: -7,    y: 6.5,  z: 17.5 },
  RADAR_FRC:  { x:  7,    y: 6.5,  z: 17.5 },
  RADAR_RLC:  { x: -7,    y: 6.5,  z:-18   },
  RADAR_RRC:  { x:  7,    y: 6.5,  z:-18   },
  SW_FL:      { x: -4,    y: 2,    z: 10   },
  SW_FR:      { x:  4,    y: 2,    z: 10   },
  SW_REAR:    { x:  0,    y: 2,    z: -8   },
  ACU_IT:     { x:  0,    y: 2,    z:-15   }
};

/* ── 3D Tilts (angled radar sensors) ── */
export const ROII_REAL_3D_TILTS = {
  RADAR_FLC: { y: -Math.PI / 6 },
  RADAR_FRC: { y:  Math.PI / 6 },
  RADAR_RLC: { y:  Math.PI / 6 },
  RADAR_RRC: { y: -Math.PI / 6 }
};

/* ── 3D Labels ── */
export const ROII_REAL_3D_LABELS = {
  LIDAR_FC:  'G32-Front-Center',  LIDAR_FL:  'Pandar-FL',
  LIDAR_FR:  'Pandar-FR',         LIDAR_R:   'G32-Rear',
  RADAR_F:   'MRR35-Front',       RADAR_FLC: 'MRR35-FLC',
  RADAR_FRC: 'MRR35-FRC',         RADAR_RLC: 'MRR35-RLC',
  RADAR_RRC: 'MRR35-RRC',
  SW_FL:     'Front-L ZC',        SW_FR:     'Front-R ZC',
  SW_REAR:   'Rear-GW',           ACU_IT:    'ACU-IT'
};

/* ── 3D Flow Paths (for animated particles) ── */
export const ROII_REAL_FLOW_PATHS = [
  { path: ['LIDAR_FC','SW_FL','SW_REAR','ACU_IT'],  color: 0x10B981 },
  { path: ['LIDAR_FL','SW_FL','SW_REAR','ACU_IT'],  color: 0x0D9488 },
  { path: ['LIDAR_FR','SW_FR','SW_REAR','ACU_IT'],  color: 0x0D9488 },
  { path: ['LIDAR_R','SW_REAR','ACU_IT'],           color: 0x10B981 },
  { path: ['RADAR_F','SW_FL','SW_REAR','ACU_IT'],   color: 0x952aff },
  { path: ['RADAR_FLC','SW_FL','SW_REAR','ACU_IT'], color: 0x952aff },
  { path: ['RADAR_FRC','SW_FR','SW_REAR','ACU_IT'], color: 0x952aff },
  { path: ['RADAR_RLC','SW_REAR','ACU_IT'],         color: 0x952aff },
  { path: ['RADAR_RRC','SW_REAR','ACU_IT'],         color: 0x952aff }
];

/* ── Device Type Classifier (for 3D templates) ── */
export function realGetDeviceType(nodeId) {
  if (nodeId === 'LIDAR_FC' || nodeId === 'LIDAR_R') return 'lidar_g32';
  if (nodeId === 'LIDAR_FL' || nodeId === 'LIDAR_FR') return 'lidar_pandar';
  if (nodeId.startsWith('RADAR')) return 'radar';
  if (nodeId === 'SW_REAR') return 'switch_r';
  if (nodeId.startsWith('SW')) return 'switch_f';
  return 'ecu';
}

/* ═══════════════════════════════════════════════════
   OPTIMAL TRI-STAR TOPOLOGY
   Each switch has a direct link to ACU_IT → all flows 2 hops
   13 nodes, 18 links (9 sensor + 6 backbone + 3 gateway)
   ═══════════════════════════════════════════════════ */

const OPTIMAL_LINKS = [
  // Sensor → switches (same assignments as Standard)
  { id: "l_lidarfc_swfl",   from: "LIDAR_FC",  to: "SW_FL",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_lidarfl_swfl",   from: "LIDAR_FL",  to: "SW_FL",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_lidarfr_swfr",   from: "LIDAR_FR",  to: "SW_FR",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_lidarr_swrear",  from: "LIDAR_R",   to: "SW_REAR", rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_radarf_swfl",    from: "RADAR_F",   to: "SW_FL",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_radarflc_swfl",  from: "RADAR_FLC", to: "SW_FL",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_radarfrc_swfr",  from: "RADAR_FRC", to: "SW_FR",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_radarrlc_swrear",from: "RADAR_RLC", to: "SW_REAR", rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_radarrrc_swrear",from: "RADAR_RRC", to: "SW_REAR", rate_mbps: 1000, prop_delay_us: 0.5 },
  // Triangle backbone (bidirectional, failover only)
  { id: "l_swfl_swfr",    from: "SW_FL",   to: "SW_FR",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_swfr_swfl",    from: "SW_FR",   to: "SW_FL",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_swfl_swrear",  from: "SW_FL",   to: "SW_REAR", rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_swrear_swfl",  from: "SW_REAR", to: "SW_FL",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_swfr_swrear",  from: "SW_FR",   to: "SW_REAR", rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_swrear_swfr",  from: "SW_REAR", to: "SW_FR",   rate_mbps: 1000, prop_delay_us: 0.5 },
  // THREE direct gateway links (key difference from Standard)
  { id: "l_swfl_acu",     from: "SW_FL",   to: "ACU_IT",  rate_mbps: 1000, prop_delay_us: 0.3 },
  { id: "l_swfr_acu",     from: "SW_FR",   to: "ACU_IT",  rate_mbps: 1000, prop_delay_us: 0.3 },
  { id: "l_swrear_acu",   from: "SW_REAR", to: "ACU_IT",  rate_mbps: 1000, prop_delay_us: 0.3 }
];

/* ── Optimal Model (10ms, 9 flows, 14 pkts/cycle) ── */
export const ROII_OPTIMAL = {
  cycle_time_us: 10000,
  guard_band_us: 12.304,
  processing_delay_us: 3,
  nodes: JSON.parse(JSON.stringify(NODES)),
  links: JSON.parse(JSON.stringify(OPTIMAL_LINKS)),
  flows: [
    { id: "f_lidar_fc", priority: 7, payload_bytes: 131072, period_us: 10000, deadline_us: 5000,
      traffic_type: "lidar", src: "LIDAR_FC", dst: "ACU_IT", k_paths: 2 },
    { id: "f_lidar_fl", priority: 7, payload_bytes: 32768, period_us: 10000, deadline_us: 5000,
      traffic_type: "lidar", src: "LIDAR_FL", dst: "ACU_IT", k_paths: 2 },
    { id: "f_lidar_fr", priority: 7, payload_bytes: 32768, period_us: 10000, deadline_us: 5000,
      traffic_type: "lidar", src: "LIDAR_FR", dst: "ACU_IT", k_paths: 2 },
    { id: "f_lidar_r",  priority: 7, payload_bytes: 131072, period_us: 10000, deadline_us: 5000,
      traffic_type: "lidar", src: "LIDAR_R",  dst: "ACU_IT", k_paths: 2 },
    { id: "f_radar_f",   priority: 6, payload_bytes: 4096, period_us: 5000, deadline_us: 2000,
      traffic_type: "radar", src: "RADAR_F",   dst: "ACU_IT", k_paths: 2 },
    { id: "f_radar_flc", priority: 6, payload_bytes: 4096, period_us: 5000, deadline_us: 2000,
      traffic_type: "radar", src: "RADAR_FLC", dst: "ACU_IT", k_paths: 2 },
    { id: "f_radar_frc", priority: 6, payload_bytes: 4096, period_us: 5000, deadline_us: 2000,
      traffic_type: "radar", src: "RADAR_FRC", dst: "ACU_IT", k_paths: 2 },
    { id: "f_radar_rlc", priority: 6, payload_bytes: 4096, period_us: 5000, deadline_us: 2000,
      traffic_type: "radar", src: "RADAR_RLC", dst: "ACU_IT", k_paths: 2 },
    { id: "f_radar_rrc", priority: 6, payload_bytes: 4096, period_us: 5000, deadline_us: 2000,
      traffic_type: "radar", src: "RADAR_RRC", dst: "ACU_IT", k_paths: 2 }
  ]
};

/* ── Optimal 2D Positions ── */
export function getOptimalPositions(W, H) {
  return {
    RADAR_FLC:  { x: W * 0.04, y: H * 0.06 },
    LIDAR_FL:   { x: W * 0.20, y: H * 0.06 },
    LIDAR_FC:   { x: W * 0.36, y: H * 0.06 },
    RADAR_F:    { x: W * 0.50, y: H * 0.06 },
    LIDAR_FR:   { x: W * 0.64, y: H * 0.06 },
    RADAR_FRC:  { x: W * 0.80, y: H * 0.06 },
    SW_FL:      { x: W * 0.22, y: H * 0.34 },
    SW_FR:      { x: W * 0.78, y: H * 0.34 },
    RADAR_RLC:  { x: W * 0.08, y: H * 0.55 },
    SW_REAR:    { x: W * 0.50, y: H * 0.52 },
    RADAR_RRC:  { x: W * 0.92, y: H * 0.55 },
    LIDAR_R:    { x: W * 0.50, y: H * 0.72 },
    ACU_IT:     { x: W * 0.50, y: H * 0.92 }
  };
}

/* ── Optimal Node Colors (same as Standard) ── */
export const ROII_OPTIMAL_NODE_COLORS = { ...ROII_REAL_NODE_COLORS };

/* ── Optimal Scenario Description ── */
export const ROII_OPTIMAL_SCENARIO = {
  title: "ROii Optimal Tri-Star \u2014 3\u00d7 Direct ACU Links",
  description: "Optimized topology: <strong>each switch has a direct 1 Gbps link to ACU-IT</strong>. All flows are 2 hops (sensor \u2192 zone switch \u2192 ACU-IT). Triangle backbone serves as failover only. Compared to Standard topology: <strong>max e2e drops from ~4200\u00b5s to ~2100\u00b5s</strong> (\u221250%), bottleneck utilization drops from 30% to 14.4%. <strong>13 nodes, 18 links, 9 flows, 14 pkts/cycle</strong>.",
  flows: [
    { name: "G32 FC \u2192 SW_FL \u2192 ACU-IT",     color: "#10B981", desc: "128KB, P7, 2 hops (1048.9\u00b5s tx/hop)" },
    { name: "Pandar FL \u2192 SW_FL \u2192 ACU-IT",  color: "#0D9488", desc: "32KB, P7, 2 hops (262.4\u00b5s tx/hop)" },
    { name: "Pandar FR \u2192 SW_FR \u2192 ACU-IT",  color: "#0D9488", desc: "32KB, P7, 2 hops (262.4\u00b5s tx/hop)" },
    { name: "G32 Rear \u2192 SW_REAR \u2192 ACU-IT", color: "#10B981", desc: "128KB, P7, 2 hops (1048.9\u00b5s tx/hop)" },
    { name: "MRR-35 F \u2192 SW_FL \u2192 ACU-IT",   color: "#952aff", desc: "4KB \u00d72pkts, P6, 50Hz (33.1\u00b5s tx)" },
    { name: "MRR-35 FLC \u2192 SW_FL \u2192 ACU-IT", color: "#952aff", desc: "4KB \u00d72pkts, P6, 50Hz (33.1\u00b5s tx)" },
    { name: "MRR-35 FRC \u2192 SW_FR \u2192 ACU-IT", color: "#952aff", desc: "4KB \u00d72pkts, P6, 50Hz (33.1\u00b5s tx)" },
    { name: "MRR-35 RLC \u2192 SW_REAR \u2192 ACU-IT", color: "#952aff", desc: "4KB \u00d72pkts, P6, 50Hz (33.1\u00b5s tx)" },
    { name: "MRR-35 RRC \u2192 SW_REAR \u2192 ACU-IT", color: "#952aff", desc: "4KB \u00d72pkts, P6, 50Hz (33.1\u00b5s tx)" }
  ],
  domains: [
    { name: "LiDAR G32 (1Gbps)",       color: "#10B981" },
    { name: "LiDAR Pandar 40P (1Gbps)", color: "#0D9488" },
    { name: "Radar MRR-35 (1Gbps)",    color: "#952aff" },
    { name: "LAN9692 Backbone",        color: "#3B82F6" },
    { name: "ACU-IT Processing",       color: "#dc2626" }
  ]
};

/* ── Optimal 3D Positions ── */
export const ROII_OPTIMAL_3D_POSITIONS = {
  LIDAR_FC:   { x:  0,    y: 5.5,  z: 18.5 },
  LIDAR_FL:   { x: -8.5,  y: 10,   z: 16.2 },
  LIDAR_FR:   { x:  8.5,  y: 10,   z: 16.2 },
  LIDAR_R:    { x:  0,    y: 5.5,  z:-18.5 },
  RADAR_F:    { x:  0,    y: 7,    z: 18.5 },
  RADAR_FLC:  { x: -7,    y: 6.5,  z: 17.5 },
  RADAR_FRC:  { x:  7,    y: 6.5,  z: 17.5 },
  RADAR_RLC:  { x: -7,    y: 6.5,  z:-18   },
  RADAR_RRC:  { x:  7,    y: 6.5,  z:-18   },
  SW_FL:      { x: -4,    y: 2,    z: 10   },
  SW_FR:      { x:  4,    y: 2,    z: 10   },
  SW_REAR:    { x:  0,    y: 2,    z: -8   },
  ACU_IT:     { x:  0,    y: 2,    z:-15   }
};

/* ── Optimal 3D Labels ── */
export const ROII_OPTIMAL_3D_LABELS = {
  LIDAR_FC:  'G32-Front-Center',  LIDAR_FL:  'Pandar-FL',
  LIDAR_FR:  'Pandar-FR',         LIDAR_R:   'G32-Rear',
  RADAR_F:   'MRR35-Front',       RADAR_FLC: 'MRR35-FLC',
  RADAR_FRC: 'MRR35-FRC',         RADAR_RLC: 'MRR35-RLC',
  RADAR_RRC: 'MRR35-RRC',
  SW_FL:     'Front-L ZC',        SW_FR:     'Front-R ZC',
  SW_REAR:   'Rear ZC',           ACU_IT:    'ACU-IT'
};

/* ═══════════════════════════════════════════════════
   HARDWARE-ACCURATE TOPOLOGY
   Based on actual ROii sensor H/W specifications.
   LiDAR: Ethernet (1000BASE-T / T1)
   Radar: CAN-FD (NOT Ethernet)
   Camera: V-by-One@HS (excluded)
   ACU_IT: Tiger Lake H — CAN-FD ×4, 1G-T, 1G-T1, 10G-T1
   Three modes: Direct / 1G Gateway / 10G-T1 Gateway
   ═══════════════════════════════════════════════════ */

/* ── HW Direct: 4 LiDARs (Ethernet) + 6 Radars (CAN-FD) → ACU_IT ── */
export const ROII_HW_DIRECT = {
  cycle_time_us: 10000,
  guard_band_us: 12.304,
  processing_delay_us: 3,
  nodes: [
    { id: "LIDAR_F",   type: "endstation" },  // Solid-state 135° FOV, 1000BASE-T1
    { id: "LIDAR_SL",  type: "endstation" },  // Rotating 360° FOV, 1000BASE-T
    { id: "LIDAR_SR",  type: "endstation" },  // Rotating 360° FOV, 1000BASE-T
    { id: "LIDAR_R",   type: "endstation" },  // Solid-state 135° FOV, 1000BASE-T1
    { id: "RADAR_F",   type: "endstation" },  // CAN-FD direct to ACU
    { id: "RADAR_FLC", type: "endstation" },  // CAN-FD direct to ACU
    { id: "RADAR_FRC", type: "endstation" },  // CAN-FD direct to ACU
    { id: "RADAR_RLC", type: "endstation" },  // CAN-FD direct to ACU
    { id: "RADAR_RRC", type: "endstation" },  // CAN-FD direct to ACU
    { id: "RADAR_R",   type: "endstation" },  // CAN-FD direct to ACU (rear center)
    { id: "ACU_IT",    type: "endstation" }
  ],
  links: [
    { id: "l_lidarf_acu",   from: "LIDAR_F",  to: "ACU_IT", rate_mbps: 1000, prop_delay_us: 0.3 },
    { id: "l_lidarsl_acu",  from: "LIDAR_SL", to: "ACU_IT", rate_mbps: 1000, prop_delay_us: 0.5 },
    { id: "l_lidarsr_acu",  from: "LIDAR_SR", to: "ACU_IT", rate_mbps: 1000, prop_delay_us: 0.5 },
    { id: "l_lidarr_acu",   from: "LIDAR_R",  to: "ACU_IT", rate_mbps: 1000, prop_delay_us: 0.3 }
  ],
  flows: [
    { id: "f_lidar_f",  priority: 7, payload_bytes: 131072, period_us: 10000, deadline_us: 5000,
      traffic_type: "lidar", src: "LIDAR_F",  dst: "ACU_IT", k_paths: 1 },
    { id: "f_lidar_sl", priority: 7, payload_bytes: 65536,  period_us: 10000, deadline_us: 5000,
      traffic_type: "lidar", src: "LIDAR_SL", dst: "ACU_IT", k_paths: 1 },
    { id: "f_lidar_sr", priority: 7, payload_bytes: 65536,  period_us: 10000, deadline_us: 5000,
      traffic_type: "lidar", src: "LIDAR_SR", dst: "ACU_IT", k_paths: 1 },
    { id: "f_lidar_r",  priority: 7, payload_bytes: 131072, period_us: 10000, deadline_us: 5000,
      traffic_type: "lidar", src: "LIDAR_R",  dst: "ACU_IT", k_paths: 1 }
  ]
};

/* ── HW Switched: 3 zone switches + CAN2ETH radar ── */
const HW_SW_NODES = [
  { id: "LIDAR_F",    type: "endstation" },
  { id: "LIDAR_SL",   type: "endstation" },
  { id: "LIDAR_SR",   type: "endstation" },
  { id: "LIDAR_R",    type: "endstation" },
  { id: "RADAR_F",    type: "endstation" },
  { id: "RADAR_FLC",  type: "endstation" },
  { id: "RADAR_FRC",  type: "endstation" },
  { id: "RADAR_RLC",  type: "endstation" },
  { id: "RADAR_RRC",  type: "endstation" },
  { id: "RADAR_R",    type: "endstation" },  // Rear center radar (CAN-FD)
  { id: "SW_FL",      type: "switch" },
  { id: "SW_FR",      type: "switch" },
  { id: "SW_REAR",    type: "switch" },
  { id: "ACU_IT",     type: "endstation" }
];

const HW_SW_LINKS = [
  // Sensor → Switch (9 links)
  { id: "l_lidarf_swfl",     from: "LIDAR_F",   to: "SW_FL",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_lidarsl_swfl",    from: "LIDAR_SL",  to: "SW_FL",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_radarflc_swfl",   from: "RADAR_FLC", to: "SW_FL",   rate_mbps: 1000, prop_delay_us: 0.2 },
  { id: "l_lidarsr_swfr",    from: "LIDAR_SR",  to: "SW_FR",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_radarf_swfr",     from: "RADAR_F",   to: "SW_FR",   rate_mbps: 1000, prop_delay_us: 0.2 },
  { id: "l_radarfrc_swfr",   from: "RADAR_FRC", to: "SW_FR",   rate_mbps: 1000, prop_delay_us: 0.2 },
  { id: "l_lidarr_swrear",   from: "LIDAR_R",   to: "SW_REAR", rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_radarrlc_swrear", from: "RADAR_RLC", to: "SW_REAR", rate_mbps: 1000, prop_delay_us: 0.2 },
  { id: "l_radarrrc_swrear", from: "RADAR_RRC", to: "SW_REAR", rate_mbps: 1000, prop_delay_us: 0.2 },
  { id: "l_radarr_swrear",  from: "RADAR_R",   to: "SW_REAR", rate_mbps: 1000, prop_delay_us: 0.2 },
  // Triangle backbone (6 bidirectional)
  { id: "l_swfl_swfr",    from: "SW_FL",   to: "SW_FR",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_swfr_swfl",    from: "SW_FR",   to: "SW_FL",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_swfl_swrear",  from: "SW_FL",   to: "SW_REAR", rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_swrear_swfl",  from: "SW_REAR", to: "SW_FL",   rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_swfr_swrear",  from: "SW_FR",   to: "SW_REAR", rate_mbps: 1000, prop_delay_us: 0.5 },
  { id: "l_swrear_swfr",  from: "SW_REAR", to: "SW_FR",   rate_mbps: 1000, prop_delay_us: 0.5 },
  // Gateway
  { id: "l_swrear_acu",   from: "SW_REAR", to: "ACU_IT",  rate_mbps: 1000, prop_delay_us: 0.3 }
];

/* ── 1G Gateway Mode (all links 1 Gbps) ── */
export const ROII_HW_1G = {
  cycle_time_us: 10000,
  guard_band_us: 12.304,
  processing_delay_us: 3,
  nodes: JSON.parse(JSON.stringify(HW_SW_NODES)),
  links: JSON.parse(JSON.stringify(HW_SW_LINKS)),
  flows: [
    // LiDAR flows (P7)
    { id: "f_lidar_f",  priority: 7, payload_bytes: 131072, period_us: 10000, deadline_us: 5000,
      traffic_type: "lidar", src: "LIDAR_F",  dst: "ACU_IT", k_paths: 2 },
    { id: "f_lidar_sl", priority: 7, payload_bytes: 65536,  period_us: 10000, deadline_us: 5000,
      traffic_type: "lidar", src: "LIDAR_SL", dst: "ACU_IT", k_paths: 2 },
    { id: "f_lidar_sr", priority: 7, payload_bytes: 65536,  period_us: 10000, deadline_us: 5000,
      traffic_type: "lidar", src: "LIDAR_SR", dst: "ACU_IT", k_paths: 2 },
    { id: "f_lidar_r",  priority: 7, payload_bytes: 131072, period_us: 10000, deadline_us: 5000,
      traffic_type: "lidar", src: "LIDAR_R",  dst: "ACU_IT", k_paths: 2 },
    // Radar via CAN2ETH (P6)
    { id: "f_radar_f",   priority: 6, payload_bytes: 512, period_us: 10000, deadline_us: 5000,
      traffic_type: "radar", src: "RADAR_F",   dst: "ACU_IT", k_paths: 2 },
    { id: "f_radar_flc", priority: 6, payload_bytes: 512, period_us: 10000, deadline_us: 5000,
      traffic_type: "radar", src: "RADAR_FLC", dst: "ACU_IT", k_paths: 2 },
    { id: "f_radar_frc", priority: 6, payload_bytes: 512, period_us: 10000, deadline_us: 5000,
      traffic_type: "radar", src: "RADAR_FRC", dst: "ACU_IT", k_paths: 2 },
    { id: "f_radar_rlc", priority: 6, payload_bytes: 512, period_us: 10000, deadline_us: 5000,
      traffic_type: "radar", src: "RADAR_RLC", dst: "ACU_IT", k_paths: 2 },
    { id: "f_radar_rrc", priority: 6, payload_bytes: 512, period_us: 10000, deadline_us: 5000,
      traffic_type: "radar", src: "RADAR_RRC", dst: "ACU_IT", k_paths: 2 },
    { id: "f_radar_r",   priority: 6, payload_bytes: 512, period_us: 10000, deadline_us: 5000,
      traffic_type: "radar", src: "RADAR_R",   dst: "ACU_IT", k_paths: 2 }
  ]
};

/* ── 10G-T1 Gateway Mode (10G uplink on SW_REAR→ACU) ── */
const HW_10G_LINKS = JSON.parse(JSON.stringify(HW_SW_LINKS));
HW_10G_LINKS.find(l => l.id === 'l_swrear_acu').rate_mbps = 10000;

export const ROII_HW_10G = {
  cycle_time_us: 10000,
  guard_band_us: 12.304,
  processing_delay_us: 3,
  nodes: JSON.parse(JSON.stringify(HW_SW_NODES)),
  links: JSON.parse(JSON.stringify(HW_10G_LINKS)),
  flows: [
    { id: "f_lidar_f",  priority: 7, payload_bytes: 131072, period_us: 10000, deadline_us: 5000,
      traffic_type: "lidar", src: "LIDAR_F",  dst: "ACU_IT", k_paths: 2 },
    { id: "f_lidar_sl", priority: 7, payload_bytes: 65536,  period_us: 10000, deadline_us: 5000,
      traffic_type: "lidar", src: "LIDAR_SL", dst: "ACU_IT", k_paths: 2 },
    { id: "f_lidar_sr", priority: 7, payload_bytes: 65536,  period_us: 10000, deadline_us: 5000,
      traffic_type: "lidar", src: "LIDAR_SR", dst: "ACU_IT", k_paths: 2 },
    { id: "f_lidar_r",  priority: 7, payload_bytes: 131072, period_us: 10000, deadline_us: 5000,
      traffic_type: "lidar", src: "LIDAR_R",  dst: "ACU_IT", k_paths: 2 },
    { id: "f_radar_f",   priority: 6, payload_bytes: 512, period_us: 10000, deadline_us: 5000,
      traffic_type: "radar", src: "RADAR_F",   dst: "ACU_IT", k_paths: 2 },
    { id: "f_radar_flc", priority: 6, payload_bytes: 512, period_us: 10000, deadline_us: 5000,
      traffic_type: "radar", src: "RADAR_FLC", dst: "ACU_IT", k_paths: 2 },
    { id: "f_radar_frc", priority: 6, payload_bytes: 512, period_us: 10000, deadline_us: 5000,
      traffic_type: "radar", src: "RADAR_FRC", dst: "ACU_IT", k_paths: 2 },
    { id: "f_radar_rlc", priority: 6, payload_bytes: 512, period_us: 10000, deadline_us: 5000,
      traffic_type: "radar", src: "RADAR_RLC", dst: "ACU_IT", k_paths: 2 },
    { id: "f_radar_rrc", priority: 6, payload_bytes: 512, period_us: 10000, deadline_us: 5000,
      traffic_type: "radar", src: "RADAR_RRC", dst: "ACU_IT", k_paths: 2 },
    { id: "f_radar_r",   priority: 6, payload_bytes: 512, period_us: 10000, deadline_us: 5000,
      traffic_type: "radar", src: "RADAR_R",   dst: "ACU_IT", k_paths: 2 }
  ]
};

/* ── HW Direct 2D Positions (10 nodes: 4 LiDAR + 5 Radar + ACU) ── */
export function getHWDirectPositions(W, H) {
  return {
    // Top row — front sensors
    RADAR_FLC: { x: W * 0.04, y: H * 0.06 },
    LIDAR_SL:  { x: W * 0.20, y: H * 0.06 },
    LIDAR_F:   { x: W * 0.36, y: H * 0.06 },
    RADAR_F:   { x: W * 0.50, y: H * 0.06 },
    LIDAR_SR:  { x: W * 0.64, y: H * 0.06 },
    RADAR_FRC: { x: W * 0.80, y: H * 0.06 },
    // Lower-middle — rear sensors
    RADAR_RLC: { x: W * 0.15, y: H * 0.42 },
    LIDAR_R:   { x: W * 0.36, y: H * 0.42 },
    RADAR_R:   { x: W * 0.50, y: H * 0.42 },
    RADAR_RRC: { x: W * 0.85, y: H * 0.42 },
    // Bottom — ACU_IT
    ACU_IT:    { x: W * 0.50, y: H * 0.85 }
  };
}

/* ── HW Switched 2D Positions ── */
export function getHWSwitchedPositions(W, H) {
  return {
    RADAR_FLC: { x: W * 0.04, y: H * 0.06 },
    LIDAR_SL:  { x: W * 0.18, y: H * 0.06 },
    LIDAR_F:   { x: W * 0.38, y: H * 0.06 },
    RADAR_F:   { x: W * 0.50, y: H * 0.06 },
    LIDAR_SR:  { x: W * 0.68, y: H * 0.06 },
    RADAR_FRC: { x: W * 0.82, y: H * 0.06 },
    SW_FL:     { x: W * 0.25, y: H * 0.34 },
    SW_FR:     { x: W * 0.75, y: H * 0.34 },
    RADAR_RLC: { x: W * 0.08, y: H * 0.60 },
    SW_REAR:   { x: W * 0.50, y: H * 0.58 },
    RADAR_RRC: { x: W * 0.92, y: H * 0.60 },
    LIDAR_R:   { x: W * 0.38, y: H * 0.78 },
    RADAR_R:   { x: W * 0.62, y: H * 0.78 },
    ACU_IT:    { x: W * 0.50, y: H * 0.92 }
  };
}

/* ── HW Direct Node Colors (includes CAN-FD radars) ── */
export const ROII_HW_DIRECT_NODE_COLORS = {
  LIDAR_F:   { fill: "#d1fae5", stroke: "#10B981", label: "Front LiDAR",   shortLabel: "135\u00b0" },
  LIDAR_SL:  { fill: "#ccfbf1", stroke: "#0D9488", label: "Side-L LiDAR",  shortLabel: "360\u00b0" },
  LIDAR_SR:  { fill: "#ccfbf1", stroke: "#0D9488", label: "Side-R LiDAR",  shortLabel: "360\u00b0" },
  LIDAR_R:   { fill: "#d1fae5", stroke: "#10B981", label: "Rear LiDAR",    shortLabel: "135\u00b0" },
  RADAR_F:   { fill: "#ede9fe", stroke: "#952aff", label: "Radar F",       shortLabel: "CAN-FD" },
  RADAR_FLC: { fill: "#ede9fe", stroke: "#952aff", label: "Radar FLC",     shortLabel: "CAN-FD" },
  RADAR_FRC: { fill: "#ede9fe", stroke: "#952aff", label: "Radar FRC",     shortLabel: "CAN-FD" },
  RADAR_RLC: { fill: "#ede9fe", stroke: "#952aff", label: "Radar RLC",     shortLabel: "CAN-FD" },
  RADAR_RRC: { fill: "#ede9fe", stroke: "#952aff", label: "Radar RRC",     shortLabel: "CAN-FD" },
  RADAR_R:   { fill: "#ede9fe", stroke: "#952aff", label: "Radar R",       shortLabel: "CAN-FD" },
  ACU_IT:    { fill: "#fee2e2", stroke: "#dc2626", label: "ACU-IT",        shortLabel: "ECU" }
};

/* ── HW Switched Node Colors ── */
export const ROII_HW_SWITCHED_NODE_COLORS = {
  LIDAR_F:   { fill: "#d1fae5", stroke: "#10B981", label: "Front LiDAR",   shortLabel: "135\u00b0" },
  LIDAR_SL:  { fill: "#ccfbf1", stroke: "#0D9488", label: "Side-L LiDAR",  shortLabel: "360\u00b0" },
  LIDAR_SR:  { fill: "#ccfbf1", stroke: "#0D9488", label: "Side-R LiDAR",  shortLabel: "360\u00b0" },
  LIDAR_R:   { fill: "#d1fae5", stroke: "#10B981", label: "Rear LiDAR",    shortLabel: "135\u00b0" },
  RADAR_F:   { fill: "#ede9fe", stroke: "#952aff", label: "Radar F",       shortLabel: "CAN2ETH" },
  RADAR_FLC: { fill: "#ede9fe", stroke: "#952aff", label: "Radar FLC",     shortLabel: "CAN2ETH" },
  RADAR_FRC: { fill: "#ede9fe", stroke: "#952aff", label: "Radar FRC",     shortLabel: "CAN2ETH" },
  RADAR_RLC: { fill: "#ede9fe", stroke: "#952aff", label: "Radar RLC",     shortLabel: "CAN2ETH" },
  RADAR_RRC: { fill: "#ede9fe", stroke: "#952aff", label: "Radar RRC",     shortLabel: "CAN2ETH" },
  RADAR_R:   { fill: "#ede9fe", stroke: "#952aff", label: "Radar R",       shortLabel: "CAN2ETH" },
  SW_FL:     { fill: "#dbeafe", stroke: "#3B82F6", label: "Front-L ZC",    shortLabel: "LAN9692" },
  SW_FR:     { fill: "#dbeafe", stroke: "#3B82F6", label: "Front-R ZC",    shortLabel: "LAN9692" },
  SW_REAR:   { fill: "#cffafe", stroke: "#06B6D4", label: "Rear GW",       shortLabel: "LAN9692" },
  ACU_IT:    { fill: "#fee2e2", stroke: "#dc2626", label: "ACU-IT",        shortLabel: "ECU" }
};

/* ── HW Switch Definitions ── */
export const ROII_HW_SWITCHES = [
  { id: "SW_FL",   label: "Front-Left ZC (LAN9692)",  chip: "LAN9692", color: "#3B82F6" },
  { id: "SW_FR",   label: "Front-Right ZC (LAN9692)", chip: "LAN9692", color: "#3B82F6" },
  { id: "SW_REAR", label: "Rear Gateway (LAN9692)",   chip: "LAN9692", color: "#06B6D4" }
];

/* ── HW Flow Color Function ── */
export function hwFlowColor(fid) {
  const id = (fid || '').toLowerCase();
  if (id.includes('lidar')) return '#10B981';
  if (id.includes('radar')) return '#952aff';
  return '#3B82F6';
}

/* ── HW Device Type Classifier ── */
export function hwGetDeviceType(nodeId) {
  if (nodeId === 'LIDAR_F' || nodeId === 'LIDAR_R') return 'lidar_g32';
  if (nodeId === 'LIDAR_SL' || nodeId === 'LIDAR_SR') return 'lidar_pandar';
  if (nodeId.startsWith('RADAR')) return 'radar';
  if (nodeId === 'SW_REAR') return 'switch_r';
  if (nodeId.startsWith('SW')) return 'switch_f';
  return 'ecu';
}

/* ── HW Scenario Descriptions ── */
export const ROII_HW_DIRECT_SCENARIO = {
  title: "ROii Hardware-Accurate \u2014 Direct (No Switches)",
  description: "Direct point-to-point: <strong>4 LiDARs connected directly to ACU-IT</strong> via dedicated 1 Gbps Ethernet links. Zero contention \u2014 each sensor has exclusive bandwidth. <strong>6 Radars connected via CAN-FD</strong> directly to ACU_IT (4 CAN-FD channels). Front/Rear LiDAR: solid-state 135\u00b0 FOV (1000BASE-T1, 128KB). Side LiDAR: rotating 360\u00b0 (1000BASE-T, 64KB). <strong>11 nodes, 4 Ethernet links, 4 TSN flows, 4 pkts/cycle</strong>.",
  flows: [
    { name: "Front LiDAR \u2192 ACU-IT",    color: "#10B981", desc: "128KB, P7, 1 hop, 1000BASE-T1 (1048.9\u00b5s tx)" },
    { name: "Side-L LiDAR \u2192 ACU-IT",   color: "#0D9488", desc: "64KB, P7, 1 hop, 1000BASE-T (524.6\u00b5s tx)" },
    { name: "Side-R LiDAR \u2192 ACU-IT",   color: "#0D9488", desc: "64KB, P7, 1 hop, 1000BASE-T (524.6\u00b5s tx)" },
    { name: "Rear LiDAR \u2192 ACU-IT",     color: "#10B981", desc: "128KB, P7, 1 hop, 1000BASE-T1 (1048.9\u00b5s tx)" },
    { name: "Radar F \u2192 ACU-IT",        color: "#952aff", desc: "CAN-FD direct, \u00b110\u00b0/\u00b145\u00b0, 220m" },
    { name: "Radar FLC/FRC \u2192 ACU-IT",  color: "#952aff", desc: "CAN-FD direct, \u00b175\u00b0, 100m (front corners)" },
    { name: "Radar RLC/RRC \u2192 ACU-IT",  color: "#952aff", desc: "CAN-FD direct, \u00b175\u00b0, 100m (rear corners)" },
    { name: "Radar R \u2192 ACU-IT",        color: "#952aff", desc: "CAN-FD direct, \u00b110\u00b0/\u00b145\u00b0, 220m (rear center)" }
  ],
  domains: [
    { name: "Solid-state LiDAR (1000BASE-T1)", color: "#10B981" },
    { name: "Rotating LiDAR (1000BASE-T)",     color: "#0D9488" },
    { name: "Radar (CAN-FD direct)",           color: "#952aff" },
    { name: "ACU-IT Processing",               color: "#dc2626" }
  ]
};

export const ROII_HW_1G_SCENARIO = {
  title: "ROii Hardware-Accurate \u2014 1G Gateway (All 1 Gbps)",
  description: "Zone-switched topology: 4 LiDARs + 6 radars (CAN2ETH) via 3 zone switches. <strong>All links 1 Gbps</strong>. Single gateway bottleneck: SW_REAR\u2192ACU_IT carries all 10 flows. Gateway utilization \u2248 <strong>31.7%</strong>. Front LiDAR worst-case E2E \u2248 3,150\u00b5s (3 hops \u00d7 1G). <strong>14 nodes, 17 links, 10 flows</strong>.",
  flows: [
    { name: "Front LiDAR \u2192 ACU-IT",    color: "#10B981", desc: "128KB, P7, 3 hops via SW_FL (1048.9\u00b5s tx/hop)" },
    { name: "Side-L LiDAR \u2192 ACU-IT",   color: "#0D9488", desc: "64KB, P7, 3 hops via SW_FL (524.6\u00b5s tx/hop)" },
    { name: "Side-R LiDAR \u2192 ACU-IT",   color: "#0D9488", desc: "64KB, P7, 3 hops via SW_FR (524.6\u00b5s tx/hop)" },
    { name: "Rear LiDAR \u2192 ACU-IT",     color: "#10B981", desc: "128KB, P7, 2 hops via SW_REAR (1048.9\u00b5s tx/hop)" },
    { name: "Front Radar \u2192 ACU-IT",     color: "#952aff", desc: "512B, P6, CAN2ETH \u2192 SW_FR (4.4\u00b5s tx)" },
    { name: "Corner FLC \u2192 ACU-IT",      color: "#952aff", desc: "512B, P6, CAN2ETH \u2192 SW_FL (4.4\u00b5s tx)" },
    { name: "Corner FRC \u2192 ACU-IT",      color: "#952aff", desc: "512B, P6, CAN2ETH \u2192 SW_FR (4.4\u00b5s tx)" },
    { name: "Corner RLC \u2192 ACU-IT",      color: "#952aff", desc: "512B, P6, CAN2ETH \u2192 SW_REAR (4.4\u00b5s tx)" },
    { name: "Corner RRC \u2192 ACU-IT",      color: "#952aff", desc: "512B, P6, CAN2ETH \u2192 SW_REAR (4.4\u00b5s tx)" },
    { name: "Rear Radar \u2192 ACU-IT",      color: "#952aff", desc: "512B, P6, CAN2ETH \u2192 SW_REAR (4.4\u00b5s tx)" }
  ],
  domains: [
    { name: "Solid-state LiDAR (1000BASE-T1)", color: "#10B981" },
    { name: "Rotating LiDAR (1000BASE-T)",     color: "#0D9488" },
    { name: "CAN2ETH Radar (bridged)",         color: "#952aff" },
    { name: "LAN9692 Backbone (1G)",           color: "#3B82F6" },
    { name: "ACU-IT Processing",               color: "#dc2626" }
  ]
};

export const ROII_HW_10G_SCENARIO = {
  title: "ROii Hardware-Accurate \u2014 10G-T1 Gateway",
  description: "Same zone-switch topology but <strong>SW_REAR\u2192ACU_IT upgraded to 10GBASE-T1</strong> (ACU_IT\u2019s native 10G port). Gateway bottleneck eliminated: utilization drops from 31.7% to <strong>3.2%</strong> (10\u00d7 reduction). Front LiDAR E2E \u2248 2,200\u00b5s (\u221230% vs 1G). Mixed-speed: sensor links 1G, gateway 10G. <strong>14 nodes, 17 links (1G+10G), 10 flows</strong>.",
  flows: [
    { name: "Front LiDAR \u2192 ACU-IT",    color: "#10B981", desc: "128KB, P7, 2\u00d71G + 1\u00d710G (1049+1049+105\u00b5s)" },
    { name: "Side-L LiDAR \u2192 ACU-IT",   color: "#0D9488", desc: "64KB, P7, 2\u00d71G + 1\u00d710G (525+525+52\u00b5s)" },
    { name: "Side-R LiDAR \u2192 ACU-IT",   color: "#0D9488", desc: "64KB, P7, 2\u00d71G + 1\u00d710G (525+525+52\u00b5s)" },
    { name: "Rear LiDAR \u2192 ACU-IT",     color: "#10B981", desc: "128KB, P7, 1\u00d71G + 1\u00d710G (1049+105\u00b5s)" },
    { name: "Front Radar \u2192 ACU-IT",     color: "#952aff", desc: "512B, P6, CAN2ETH 2\u00d71G + 1\u00d710G" },
    { name: "Corner FLC \u2192 ACU-IT",      color: "#952aff", desc: "512B, P6, CAN2ETH 2\u00d71G + 1\u00d710G" },
    { name: "Corner FRC \u2192 ACU-IT",      color: "#952aff", desc: "512B, P6, CAN2ETH 2\u00d71G + 1\u00d710G" },
    { name: "Corner RLC \u2192 ACU-IT",      color: "#952aff", desc: "512B, P6, CAN2ETH 1\u00d71G + 1\u00d710G" },
    { name: "Corner RRC \u2192 ACU-IT",      color: "#952aff", desc: "512B, P6, CAN2ETH 1\u00d71G + 1\u00d710G" },
    { name: "Rear Radar \u2192 ACU-IT",      color: "#952aff", desc: "512B, P6, CAN2ETH 1\u00d71G + 1\u00d710G" }
  ],
  domains: [
    { name: "Solid-state LiDAR (1000BASE-T1)", color: "#10B981" },
    { name: "Rotating LiDAR (1000BASE-T)",     color: "#0D9488" },
    { name: "CAN2ETH Radar (bridged)",         color: "#952aff" },
    { name: "LAN9692 Backbone (1G)",           color: "#3B82F6" },
    { name: "10G-T1 Gateway",                  color: "#dc2626" },
    { name: "ACU-IT Processing",               color: "#dc2626" }
  ]
};

/* ── HW 3D Positions (Direct: 10 nodes — LiDAR + Radar + ACU) ── */
export const ROII_HW_DIRECT_3D_POSITIONS = {
  LIDAR_F:   { x:  0,    y: 5.5,  z: 18.5 },
  LIDAR_SL:  { x: -8.5,  y: 10,   z: 16.2 },
  LIDAR_SR:  { x:  8.5,  y: 10,   z: 16.2 },
  LIDAR_R:   { x:  0,    y: 5.5,  z:-18.5 },
  RADAR_F:   { x:  0,    y: 7,    z: 18.5 },
  RADAR_FLC: { x: -7,    y: 6.5,  z: 17.5 },
  RADAR_FRC: { x:  7,    y: 6.5,  z: 17.5 },
  RADAR_RLC: { x: -7,    y: 6.5,  z:-18   },
  RADAR_RRC: { x:  7,    y: 6.5,  z:-18   },
  RADAR_R:   { x:  0,    y: 7,    z:-18.5 },
  ACU_IT:    { x:  0,    y: 2,    z:-15   }
};

/* ── HW 3D Positions (Switched: 14 nodes) ── */
export const ROII_HW_SWITCHED_3D_POSITIONS = {
  LIDAR_F:   { x:  0,    y: 5.5,  z: 18.5 },
  LIDAR_SL:  { x: -8.5,  y: 10,   z: 16.2 },
  LIDAR_SR:  { x:  8.5,  y: 10,   z: 16.2 },
  LIDAR_R:   { x:  0,    y: 5.5,  z:-18.5 },
  RADAR_F:   { x:  0,    y: 7,    z: 18.5 },
  RADAR_FLC: { x: -7,    y: 6.5,  z: 17.5 },
  RADAR_FRC: { x:  7,    y: 6.5,  z: 17.5 },
  RADAR_RLC: { x: -7,    y: 6.5,  z:-18   },
  RADAR_RRC: { x:  7,    y: 6.5,  z:-18   },
  RADAR_R:   { x:  0,    y: 7,    z:-18.5 },
  SW_FL:     { x: -4,    y: 2,    z: 10   },
  SW_FR:     { x:  4,    y: 2,    z: 10   },
  SW_REAR:   { x:  0,    y: 2,    z: -8   },
  ACU_IT:    { x:  0,    y: 2,    z:-15   }
};

/* ── HW 3D Labels ── */
export const ROII_HW_3D_LABELS = {
  LIDAR_F:   'Front-LiDAR',   LIDAR_SL:  'Side-L-LiDAR',
  LIDAR_SR:  'Side-R-LiDAR',  LIDAR_R:   'Rear-LiDAR',
  RADAR_F:   'Radar-Front',   RADAR_FLC: 'Radar-FLC',
  RADAR_FRC: 'Radar-FRC',     RADAR_RLC: 'Radar-RLC',
  RADAR_RRC: 'Radar-RRC',     RADAR_R:   'Radar-Rear',
  SW_FL:     'Front-L ZC',    SW_FR:     'Front-R ZC',
  SW_REAR:   'Rear-GW',       ACU_IT:    'ACU-IT'
};

/* ── HW 3D Tilts ── */
export const ROII_HW_3D_TILTS = {
  RADAR_FLC: { y: -Math.PI / 6 },
  RADAR_FRC: { y:  Math.PI / 6 },
  RADAR_RLC: { y:  Math.PI / 6 },
  RADAR_RRC: { y: -Math.PI / 6 }
};

/* ═══════════════════════════════════════════════════
   8-TC DEDICATED PCP MODEL
   All 8 traffic classes dedicated to sensor flows — no best-effort.
   Each LiDAR gets its own PCP (7–4), radars share remaining PCPs (3–0).
   Same Standard topology (13 nodes, 16 links, 9 flows).
   ═══════════════════════════════════════════════════ */

export const ROII_REAL_8TC = {
  cycle_time_us: 1000,       // 1 ms — frame-level GCL cycle
  guard_band_us: 0,
  processing_delay_us: 3,
  no_be: true,
  nodes: JSON.parse(JSON.stringify(NODES)),
  links: JSON.parse(JSON.stringify(LINKS)),
  flows: [
    // ── LiDAR flows — each gets dedicated PCP ──
    // AutoL G32: 1248 B sensor payload + 28 B (IP+UDP) = 1276 B Ethernet payload
    // TX = (1276+38)×8/1000 = 10.512 µs | Real period: 167 µs (6000 fps) → model: 200 µs
    { id: "f_lidar_fc", PCP: 7, payload_bytes: 1276, period_us: 200, deadline_us: 1000,
      traffic_type: "lidar", src: "LIDAR_FC", dst: "ACU_IT", k_paths: 2 },
    { id: "f_lidar_r",  PCP: 6, payload_bytes: 1276, period_us: 200, deadline_us: 1000,
      traffic_type: "lidar", src: "LIDAR_R",  dst: "ACU_IT", k_paths: 2 },
    // Hesai Pandar 40P: 1262 B sensor payload + 28 B = 1290 B Ethernet payload
    // TX = (1290+38)×8/1000 = 10.624 µs | Real period: 536 µs (1866 fps) → model: 500 µs
    { id: "f_lidar_fl", PCP: 5, payload_bytes: 1290, period_us: 500, deadline_us: 1000,
      traffic_type: "lidar", src: "LIDAR_FL", dst: "ACU_IT", k_paths: 2 },
    { id: "f_lidar_fr", PCP: 4, payload_bytes: 1290, period_us: 500, deadline_us: 1000,
      traffic_type: "lidar", src: "LIDAR_FR", dst: "ACU_IT", k_paths: 2 },
    // ── Radar flows — remaining PCPs ──
    // Continental MRR-35: 64 B CAN-FD payload (raw Ethernet, no IP/UDP)
    // TX = (64+38)×8/1000 = 0.816 µs | Period: 500 µs (CAN-FD inter-frame interval)
    { id: "f_radar_f",   PCP: 3, payload_bytes: 64, period_us: 500, deadline_us: 1000,
      traffic_type: "radar", src: "RADAR_F",   dst: "ACU_IT", k_paths: 2 },
    { id: "f_radar_flc", PCP: 2, payload_bytes: 64, period_us: 500, deadline_us: 1000,
      traffic_type: "radar", src: "RADAR_FLC", dst: "ACU_IT", k_paths: 2 },
    { id: "f_radar_frc", PCP: 2, payload_bytes: 64, period_us: 500, deadline_us: 1000,
      traffic_type: "radar", src: "RADAR_FRC", dst: "ACU_IT", k_paths: 2 },
    { id: "f_radar_rlc", PCP: 1, payload_bytes: 64, period_us: 500, deadline_us: 1000,
      traffic_type: "radar", src: "RADAR_RLC", dst: "ACU_IT", k_paths: 2 },
    { id: "f_radar_rrc", PCP: 1, payload_bytes: 64, period_us: 500, deadline_us: 1000,
      traffic_type: "radar", src: "RADAR_RRC", dst: "ACU_IT", k_paths: 2 },
      // Background traffic — varied payload sizes, non-ST (PCP 0, no deadline)
    { id: "f_bg_small",  PCP: 0, payload_bytes: 200,   period_us: 500, deadline_us: null, rel: 0,
      traffic_type: "background", src: "BG", dst: "ACU_IT", k_paths: 1,
      path: ["l_bg_swfr", "l_swfr_swrear", "l_swrear_acu"] },
    { id: "f_bg_large",  PCP: 0, payload_bytes: 1400, period_us: 1000, deadline_us: null, rel: 200,
      traffic_type: "background", src: "BG", dst: "ACU_IT", k_paths: 1 }
  ]
};

/* ── 8-TC Scenario Description ── */
export const ROII_8TC_SCENARIO = {
  title: "ROii 8-TC Frame-Level \u2014 No Best-Effort",
  description: "Frame-level sensor scheduling: each Ethernet frame modeled individually. <strong>No burst aggregation, no guard band, no best-effort</strong>. AutoL G32: 1248 B sensor + 28 B IP/UDP = 1276 B (10.512 \u00b5s TX). Hesai Pandar 40P: 1262 B + 28 B = 1290 B (10.624 \u00b5s TX). MRR-35: 64 B CAN-FD (0.816 \u00b5s TX). Cycle: 1000 \u00b5s (1 ms). <strong>9 flows, 24 pkts/cycle, ~15.6% bottleneck util</strong>.",
  flows: [
    { name: "G32 FC \u2192 ACU-IT",      color: "#10B981", desc: "1276B, PCP 7, 200\u00b5s period (10.512\u00b5s TX)" },
    { name: "G32 Rear \u2192 ACU-IT",    color: "#10B981", desc: "1276B, PCP 6, 200\u00b5s period (10.512\u00b5s TX)" },
    { name: "Pandar FL \u2192 ACU-IT",   color: "#0D9488", desc: "1290B, PCP 5, 500\u00b5s period (10.624\u00b5s TX)" },
    { name: "Pandar FR \u2192 ACU-IT",   color: "#0D9488", desc: "1290B, PCP 4, 500\u00b5s period (10.624\u00b5s TX)" },
    { name: "MRR-35 F \u2192 ACU-IT",    color: "#952aff", desc: "64B CAN-FD, PCP 3, 500\u00b5s (0.816\u00b5s TX)" },
    { name: "MRR-35 FLC \u2192 ACU-IT",  color: "#952aff", desc: "64B CAN-FD, PCP 2, 500\u00b5s (0.816\u00b5s TX)" },
    { name: "MRR-35 FRC \u2192 ACU-IT",  color: "#952aff", desc: "64B CAN-FD, PCP 1, 500\u00b5s (0.816\u00b5s TX)" },
    { name: "MRR-35 RLC \u2192 ACU-IT",  color: "#952aff", desc: "64B CAN-FD, PCP 0, 500\u00b5s (0.816\u00b5s TX)" },
    { name: "MRR-35 RRC \u2192 ACU-IT",  color: "#952aff", desc: "64B CAN-FD, PCP 0, 500\u00b5s (0.816\u00b5s TX)" }
  ],
  domains: [
    { name: "AutoL G32 (PCP 7/6)",       color: "#10B981" },
    { name: "Hesai Pandar 40P (PCP 5/4)", color: "#0D9488" },
    { name: "MRR-35 CAN-FD (PCP 3\u20130)", color: "#952aff" },
    { name: "LAN9692 Backbone",           color: "#3B82F6" },
    { name: "ACU-IT Processing",          color: "#dc2626" }
  ]
};
