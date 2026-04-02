// Pre-computed ILP optimal result for Case 2 (12 flows, 1000µs cycle, 1 Gbps)
// Generated once and cached to avoid re-solving on every page load.
export const CASE2_PROFILE = {
  method: "ILP (GLPK, optimal)",
  objective: 10060.068,
  total_e2e_delay_us: 2560.068,
  worst_delay_us: 265.14,
  worst_delay_packet: "f_lidar_fl#0",
  worst_util_percent: 91,
  packetRows: [
    { packet_id:"f_radar_rlc#0", flow_id:"f_radar_rlc", priority:2, selected_route:0, release_us:0, end_us:11.24, e2e_delay_us:11.24, deadline_abs_us:1000, slack_us:1100.76, status:"OK",
      hops:[{link_id:"l_radarrlc_swrear",start_us:0,end_us:4.12,duration_us:4.12},{link_id:"l_swrear_acu",start_us:7.12,end_us:11.24,duration_us:4.12}]},
    { packet_id:"f_radar_rrc#0", flow_id:"f_radar_rrc", priority:2, selected_route:0, release_us:0, end_us:15.36, e2e_delay_us:15.36, deadline_abs_us:1000, slack_us:1096.64, status:"OK",
      hops:[{link_id:"l_radarrrc_swrear",start_us:0,end_us:4.12,duration_us:4.12},{link_id:"l_swrear_acu",start_us:11.24,end_us:15.36,duration_us:4.12}]},
    { packet_id:"f_radar_f#0", flow_id:"f_radar_f", priority:7, selected_route:0, release_us:0, end_us:19.48, e2e_delay_us:19.48, deadline_abs_us:1000, slack_us:1092.52, status:"OK",
      hops:[{link_id:"l_radarf_swfl",start_us:0,end_us:4.12,duration_us:4.12},{link_id:"l_swfl_swrear",start_us:7.12,end_us:11.24,duration_us:4.12},{link_id:"l_swrear_acu",start_us:15.36,end_us:19.48,duration_us:4.12}]},
    { packet_id:"f_radar_flc#0", flow_id:"f_radar_flc", priority:7, selected_route:0, release_us:0, end_us:23.5, e2e_delay_us:23.5, deadline_abs_us:1000, slack_us:1088.5, status:"OK",
      hops:[{link_id:"l_radarflc_swfl",start_us:0,end_us:4.12,duration_us:4.12},{link_id:"l_swfl_swrear",start_us:11.24,end_us:15.36,duration_us:4.12},{link_id:"l_swrear_acu",start_us:19.48,end_us:23.5,duration_us:4.02}]},
    { packet_id:"f_radar_frc#0", flow_id:"f_radar_frc", priority:3, selected_route:0, release_us:0, end_us:27.62, e2e_delay_us:27.62, deadline_abs_us:1000, slack_us:1084.38, status:"OK",
      hops:[{link_id:"l_radarfrc_swfr",start_us:0,end_us:4.12,duration_us:4.12},{link_id:"l_swfr_swrear",start_us:7.12,end_us:11.24,duration_us:4.12},{link_id:"l_swrear_acu",start_us:23.5,end_us:27.62,duration_us:4.12}]},
    { packet_id:"f_lidar_r#0", flow_id:"f_lidar_r", priority:1, selected_route:0, release_us:0, end_us:108.2, e2e_delay_us:108.2, deadline_abs_us:200, slack_us:91.8, status:"OK",
      hops:[{link_id:"l_lidarr_swrear",start_us:0,end_us:52.6,duration_us:52.6},{link_id:"l_swrear_acu",start_us:55.6,end_us:108.2,duration_us:52.6}]},
    { packet_id:"f_lidar_fc#0", flow_id:"f_lidar_fc", priority:5, selected_route:0, release_us:0, end_us:163.8, e2e_delay_us:163.8, deadline_abs_us:200, slack_us:36.2, status:"OK",
      hops:[{link_id:"l_lidarfc_swfl",start_us:0,end_us:52.6,duration_us:52.6},{link_id:"l_swfl_swrear",start_us:55.6,end_us:108.2,duration_us:52.6},{link_id:"l_swrear_acu",start_us:111.2,end_us:163.8,duration_us:52.6}]},
    { packet_id:"f_lidar_fr#0", flow_id:"f_lidar_fr", priority:4, selected_route:0, release_us:0, end_us:216.96, e2e_delay_us:216.96, deadline_abs_us:500, slack_us:283.04, status:"OK",
      hops:[{link_id:"l_lidarfr_swfr",start_us:0,end_us:53.16,duration_us:53.16},{link_id:"l_swfr_swrear",start_us:56.16,end_us:110.32,duration_us:54.16},{link_id:"l_swrear_acu",start_us:163.8,end_us:216.96,duration_us:53.16}]},
    { packet_id:"f_lidar_fl#0", flow_id:"f_lidar_fl", priority:6, selected_route:0, release_us:0, end_us:270.12, e2e_delay_us:270.12, deadline_abs_us:500, slack_us:229.88, status:"OK",
      hops:[{link_id:"l_lidarfl_swfl",start_us:0,end_us:53.16,duration_us:53.16},{link_id:"l_swfl_swrear",start_us:108.2,end_us:161.36,duration_us:53.16},{link_id:"l_swrear_acu",start_us:216.96,end_us:270.12,duration_us:53.16}]},
    { packet_id:"f_lidar_r#1", flow_id:"f_lidar_r", priority:1, selected_route:0, release_us:200, end_us:322.72, e2e_delay_us:122.72, deadline_abs_us:400, slack_us:77.28, status:"OK",
      hops:[{link_id:"l_lidarr_swrear",start_us:200,end_us:252.6,duration_us:52.6},{link_id:"l_swrear_acu",start_us:270.12,end_us:322.72,duration_us:52.6}]},
    { packet_id:"f_lidar_fc#1", flow_id:"f_lidar_fc", priority:5, selected_route:0, release_us:200, end_us:375.32, e2e_delay_us:175.32, deadline_abs_us:400, slack_us:24.68, status:"OK",
      hops:[{link_id:"l_lidarfc_swfl",start_us:200,end_us:252.6,duration_us:52.6},{link_id:"l_swfl_swrear",start_us:253.6,end_us:306.2,duration_us:52.6},{link_id:"l_swrear_acu",start_us:322.72,end_us:375.32,duration_us:52.6}]},
    { packet_id:"f_lidar_r#2", flow_id:"f_lidar_r", priority:1, selected_route:0, release_us:400, end_us:508.3, e2e_delay_us:108.3, deadline_abs_us:600, slack_us:91.7, status:"OK",
      hops:[{link_id:"l_lidarr_swrear",start_us:400,end_us:452.7,duration_us:52.7},{link_id:"l_swrear_acu",start_us:455.7,end_us:508.3,duration_us:52.6}]},
    { packet_id:"f_radar_rlc#1", flow_id:"f_radar_rlc", priority:2, selected_route:0, release_us:500, end_us:512.42, e2e_delay_us:12.42, deadline_abs_us:1612, slack_us:1099.58, status:"OK",
      hops:[{link_id:"l_radarrlc_swrear",start_us:500,end_us:504.12,duration_us:4.12},{link_id:"l_swrear_acu",start_us:508.3,end_us:512.42,duration_us:4.12}]},
    { packet_id:"f_radar_rrc#1", flow_id:"f_radar_rrc", priority:2, selected_route:0, release_us:500, end_us:516.54, e2e_delay_us:16.54, deadline_abs_us:1612, slack_us:1095.46, status:"OK",
      hops:[{link_id:"l_radarrrc_swrear",start_us:500,end_us:504.12,duration_us:4.12},{link_id:"l_swrear_acu",start_us:512.42,end_us:516.54,duration_us:4.12}]},
    { packet_id:"f_radar_f#1", flow_id:"f_radar_f", priority:7, selected_route:0, release_us:500, end_us:520.66, e2e_delay_us:20.66, deadline_abs_us:1612, slack_us:1091.34, status:"OK",
      hops:[{link_id:"l_radarf_swfl",start_us:500,end_us:504.12,duration_us:4.12},{link_id:"l_swfl_swrear",start_us:507.12,end_us:511.24,duration_us:4.12},{link_id:"l_swrear_acu",start_us:516.54,end_us:520.66,duration_us:4.12}]},
    { packet_id:"f_radar_flc#1", flow_id:"f_radar_flc", priority:7, selected_route:0, release_us:500, end_us:524.78, e2e_delay_us:24.78, deadline_abs_us:1612, slack_us:1087.22, status:"OK",
      hops:[{link_id:"l_radarflc_swfl",start_us:500,end_us:504.12,duration_us:4.12},{link_id:"l_swfl_swrear",start_us:511.24,end_us:515.36,duration_us:4.12},{link_id:"l_swrear_acu",start_us:520.66,end_us:524.78,duration_us:4.12}]},
    { packet_id:"f_radar_frc#1", flow_id:"f_radar_frc", priority:3, selected_route:1, release_us:500, end_us:528.9, e2e_delay_us:28.9, deadline_abs_us:1612, slack_us:1083.1, status:"OK",
      hops:[{link_id:"l_radarfrc_swfr",start_us:500,end_us:504.12,duration_us:4.12},{link_id:"l_swfr_swfl",start_us:507.12,end_us:511.24,duration_us:4.12},{link_id:"l_swfl_swrear",start_us:515.36,end_us:519.48,duration_us:4.12},{link_id:"l_swrear_acu",start_us:524.78,end_us:528.9,duration_us:4.12}]},
    { packet_id:"f_lidar_fc#2", flow_id:"f_lidar_fc", priority:5, selected_route:1, release_us:400, end_us:619.5, e2e_delay_us:219.5, deadline_abs_us:600, slack_us:-19.5, status:"OK",
      hops:[{link_id:"l_lidarfc_swfl",start_us:400,end_us:452.7,duration_us:52.7},{link_id:"l_swfl_swfr",start_us:455.7,end_us:508.3,duration_us:52.6},{link_id:"l_swfr_swrear",start_us:511.3,end_us:563.9,duration_us:52.6},{link_id:"l_swrear_acu",start_us:566.9,end_us:619.5,duration_us:52.6}]},
    { packet_id:"f_lidar_fl#1", flow_id:"f_lidar_fl", priority:6, selected_route:0, release_us:500, end_us:672.66, e2e_delay_us:172.66, deadline_abs_us:1000, slack_us:327.34, status:"OK",
      hops:[{link_id:"l_lidarfl_swfl",start_us:500,end_us:553.16,duration_us:53.16},{link_id:"l_swfl_swrear",start_us:556.16,end_us:609.32,duration_us:53.16},{link_id:"l_swrear_acu",start_us:619.5,end_us:672.66,duration_us:53.16}]},
    { packet_id:"f_lidar_fr#1", flow_id:"f_lidar_fr", priority:4, selected_route:1, release_us:500, end_us:725.82, e2e_delay_us:225.82, deadline_abs_us:1000, slack_us:274.18, status:"OK",
      hops:[{link_id:"l_lidarfr_swfr",start_us:500,end_us:553.16,duration_us:53.16},{link_id:"l_swfr_swfl",start_us:556.16,end_us:609.32,duration_us:53.16},{link_id:"l_swfl_swrear",start_us:612.32,end_us:665.48,duration_us:53.16},{link_id:"l_swrear_acu",start_us:672.66,end_us:725.82,duration_us:53.16}]},
    { packet_id:"f_lidar_fc#3", flow_id:"f_lidar_fc", priority:5, selected_route:0, release_us:600, end_us:778.42, e2e_delay_us:178.42, deadline_abs_us:800, slack_us:21.58, status:"OK",
      hops:[{link_id:"l_lidarfc_swfl",start_us:600,end_us:652.7,duration_us:52.7},{link_id:"l_swfl_swrear",start_us:665.48,end_us:718.08,duration_us:52.6},{link_id:"l_swrear_acu",start_us:725.82,end_us:778.42,duration_us:52.6}]},
    { packet_id:"f_lidar_r#3", flow_id:"f_lidar_r", priority:1, selected_route:0, release_us:600, end_us:831.02, e2e_delay_us:231.02, deadline_abs_us:800, slack_us:-31.02, status:"OK",
      hops:[{link_id:"l_lidarr_swrear",start_us:600,end_us:652.7,duration_us:52.7},{link_id:"l_swrear_acu",start_us:778.42,end_us:831.02,duration_us:52.6}]},
    { packet_id:"f_lidar_r#4", flow_id:"f_lidar_r", priority:1, selected_route:0, release_us:800, end_us:908.3, e2e_delay_us:108.3, deadline_abs_us:1000, slack_us:91.7, status:"OK",
      hops:[{link_id:"l_lidarr_swrear",start_us:800,end_us:852.7,duration_us:52.7},{link_id:"l_swrear_acu",start_us:855.7,end_us:908.3,duration_us:52.6}]},
    { packet_id:"f_lidar_fc#4", flow_id:"f_lidar_fc", priority:5, selected_route:0, release_us:800, end_us:963.9, e2e_delay_us:163.9, deadline_abs_us:1000, slack_us:36.1, status:"OK",
      hops:[{link_id:"l_lidarfc_swfl",start_us:800,end_us:852.7,duration_us:52.7},{link_id:"l_swfl_swrear",start_us:855.7,end_us:908.3,duration_us:52.6},{link_id:"l_swrear_acu",start_us:911.3,end_us:963.9,duration_us:52.6}]}
  ],
  gcl: {
    cycleTime: 1000,
    base_time_us: 0,
    links: {
      l_lidarfc_swfl: { from:"LIDAR_FC", to:"SW_FL", entries:[
        {index:0,gate_mask:"00100000",start_us:0,end_us:52.6,duration_us:52.6,note:"f_lidar_fc#0"},
        {index:1,gate_mask:"00000001",start_us:52.6,end_us:200,duration_us:147.4,note:"BE (TC0)"},
        {index:2,gate_mask:"00100000",start_us:200,end_us:252.6,duration_us:52.6,note:"f_lidar_fc#1"},
        {index:3,gate_mask:"00000001",start_us:252.6,end_us:400,duration_us:147.4,note:"BE (TC0)"},
        {index:4,gate_mask:"00100000",start_us:400,end_us:452.6,duration_us:52.6,note:"f_lidar_fc#2"},
        {index:5,gate_mask:"00000001",start_us:452.6,end_us:600,duration_us:147.4,note:"BE (TC0)"},
        {index:6,gate_mask:"00100000",start_us:600,end_us:652.6,duration_us:52.6,note:"f_lidar_fc#3"},
        {index:7,gate_mask:"00000001",start_us:652.6,end_us:800,duration_us:147.4,note:"BE (TC0)"},
        {index:8,gate_mask:"00100000",start_us:800,end_us:852.6,duration_us:52.6,note:"f_lidar_fc#4"},
        {index:9,gate_mask:"00000001",start_us:852.6,end_us:1000,duration_us:147.4,note:"BE (TC0)"}
      ]},
      l_lidarfl_swfl: { from:"LIDAR_FL", to:"SW_FL", entries:[
        {index:0,gate_mask:"01000000",start_us:0,end_us:53.16,duration_us:53.16,note:"f_lidar_fl#0"},
        {index:1,gate_mask:"00000001",start_us:53.16,end_us:500,duration_us:446.84,note:"BE (TC0)"},
        {index:2,gate_mask:"01000000",start_us:500,end_us:553.16,duration_us:53.16,note:"f_lidar_fl#1"},
        {index:3,gate_mask:"00000001",start_us:553.16,end_us:1000,duration_us:446.84,note:"BE (TC0)"}
      ]},
      l_lidarfr_swfr: { from:"LIDAR_FR", to:"SW_FR", entries:[
        {index:0,gate_mask:"00010000",start_us:0,end_us:53.16,duration_us:53.16,note:"f_lidar_fr#0"},
        {index:1,gate_mask:"00000001",start_us:53.16,end_us:500,duration_us:446.84,note:"BE (TC0)"},
        {index:2,gate_mask:"00010000",start_us:500,end_us:553.16,duration_us:53.16,note:"f_lidar_fr#1"},
        {index:3,gate_mask:"00000001",start_us:553.16,end_us:1000,duration_us:446.84,note:"BE (TC0)"}
      ]},
      l_lidarr_swrear: { from:"LIDAR_R", to:"SW_REAR", entries:[
        {index:0,gate_mask:"00000010",start_us:0,end_us:52.6,duration_us:52.6,note:"f_lidar_r#0"},
        {index:1,gate_mask:"00000001",start_us:52.6,end_us:200,duration_us:147.4,note:"BE (TC0)"},
        {index:2,gate_mask:"00000010",start_us:200,end_us:252.6,duration_us:52.6,note:"f_lidar_r#1"},
        {index:3,gate_mask:"00000001",start_us:252.6,end_us:400,duration_us:147.4,note:"BE (TC0)"},
        {index:4,gate_mask:"00000010",start_us:400,end_us:452.6,duration_us:52.6,note:"f_lidar_r#2"},
        {index:5,gate_mask:"00000001",start_us:452.6,end_us:600,duration_us:147.4,note:"BE (TC0)"},
        {index:6,gate_mask:"00000010",start_us:600,end_us:652.6,duration_us:52.6,note:"f_lidar_r#3"},
        {index:7,gate_mask:"00000001",start_us:652.6,end_us:800,duration_us:147.4,note:"BE (TC0)"},
        {index:8,gate_mask:"00000010",start_us:800,end_us:852.6,duration_us:52.6,note:"f_lidar_r#4"},
        {index:9,gate_mask:"00000001",start_us:852.6,end_us:1000,duration_us:147.4,note:"BE (TC0)"}
      ]},
      l_radarf_swfl: { from:"RADAR_F", to:"SW_FL", entries:[
        {index:0,gate_mask:"10000000",start_us:0,end_us:4.12,duration_us:4.12,note:"f_radar_f#0"},
        {index:1,gate_mask:"00000001",start_us:4.12,end_us:500,duration_us:495.88,note:"BE (TC0)"},
        {index:2,gate_mask:"10000000",start_us:500,end_us:504.12,duration_us:4.12,note:"f_radar_f#1"},
        {index:3,gate_mask:"00000001",start_us:504.12,end_us:1000,duration_us:495.88,note:"BE (TC0)"}
      ]},
      l_radarflc_swfl: { from:"RADAR_FLC", to:"SW_FL", entries:[
        {index:0,gate_mask:"10000000",start_us:0,end_us:4.12,duration_us:4.12,note:"f_radar_flc#0"},
        {index:1,gate_mask:"00000001",start_us:4.12,end_us:500,duration_us:495.88,note:"BE (TC0)"},
        {index:2,gate_mask:"10000000",start_us:500,end_us:504.12,duration_us:4.12,note:"f_radar_flc#1"},
        {index:3,gate_mask:"00000001",start_us:504.12,end_us:1000,duration_us:495.88,note:"BE (TC0)"}
      ]},
      l_radarfrc_swfr: { from:"RADAR_FRC", to:"SW_FR", entries:[
        {index:0,gate_mask:"00001000",start_us:0,end_us:4.12,duration_us:4.12,note:"f_radar_frc#0"},
        {index:1,gate_mask:"00000001",start_us:4.12,end_us:500,duration_us:495.88,note:"BE (TC0)"},
        {index:2,gate_mask:"00001000",start_us:500,end_us:504.12,duration_us:4.12,note:"f_radar_frc#1"},
        {index:3,gate_mask:"00000001",start_us:504.12,end_us:1000,duration_us:495.88,note:"BE (TC0)"}
      ]},
      l_radarrlc_swrear: { from:"RADAR_RLC", to:"SW_REAR", entries:[
        {index:0,gate_mask:"00000100",start_us:0,end_us:4.12,duration_us:4.12,note:"f_radar_rlc#0"},
        {index:1,gate_mask:"00000001",start_us:4.12,end_us:500,duration_us:495.88,note:"BE (TC0)"},
        {index:2,gate_mask:"00000100",start_us:500,end_us:504.12,duration_us:4.12,note:"f_radar_rlc#1"},
        {index:3,gate_mask:"00000001",start_us:504.12,end_us:1000,duration_us:495.88,note:"BE (TC0)"}
      ]},
      l_radarrrc_swrear: { from:"RADAR_RRC", to:"SW_REAR", entries:[
        {index:0,gate_mask:"00000100",start_us:0,end_us:4.12,duration_us:4.12,note:"f_radar_rrc#0"},
        {index:1,gate_mask:"00000001",start_us:4.12,end_us:500,duration_us:495.88,note:"BE (TC0)"},
        {index:2,gate_mask:"00000100",start_us:500,end_us:504.12,duration_us:4.12,note:"f_radar_rrc#1"},
        {index:3,gate_mask:"00000001",start_us:504.12,end_us:1000,duration_us:495.88,note:"BE (TC0)"}
      ]},
      l_bg1_swfr: { from:"BG1", to:"SW_FR", entries:[
        {index:0,gate_mask:"00000001",start_us:0,end_us:1000,duration_us:1000,note:"BE (TC0)"}
      ]},
      l_bg2_swrear: { from:"BG2", to:"SW_REAR", entries:[
        {index:0,gate_mask:"00000001",start_us:0,end_us:1000,duration_us:1000,note:"BE (TC0)"}
      ]},
      l_bg3_swfl: { from:"BG3", to:"SW_FL", entries:[
        {index:0,gate_mask:"00000001",start_us:0,end_us:1000,duration_us:1000,note:"BE (TC0)"}
      ]},
      l_swfl_swfr: { from:"SW_FL", to:"SW_FR", entries:[
        {index:0,gate_mask:"00000001",start_us:0,end_us:443.396,duration_us:443.396,note:"BE (TC0)"},
        {index:1,gate_mask:"00000000",start_us:443.396,end_us:455.7,duration_us:12.304,note:"guard"},
        {index:2,gate_mask:"00100000",start_us:455.7,end_us:508.3,duration_us:52.6,note:"f_lidar_fc#2"},
        {index:3,gate_mask:"00000001",start_us:508.3,end_us:1000,duration_us:491.7,note:"BE (TC0)"}
      ]},
      l_swfr_swfl: { from:"SW_FR", to:"SW_FL", entries:[
        {index:0,gate_mask:"00000001",start_us:0,end_us:494.816,duration_us:494.816,note:"BE (TC0)"},
        {index:1,gate_mask:"00000000",start_us:494.816,end_us:507.12,duration_us:12.304,note:"guard"},
        {index:2,gate_mask:"00001000",start_us:507.12,end_us:511.24,duration_us:4.12,note:"f_radar_frc#1"},
        {index:3,gate_mask:"00000001",start_us:511.24,end_us:543.856,duration_us:32.616,note:"BE (TC0)"},
        {index:4,gate_mask:"00000000",start_us:543.856,end_us:556.16,duration_us:12.304,note:"guard"},
        {index:5,gate_mask:"00010000",start_us:556.16,end_us:609.32,duration_us:53.16,note:"f_lidar_fr#1"},
        {index:6,gate_mask:"00000001",start_us:609.32,end_us:1000,duration_us:390.68,note:"BE (TC0)"}
      ]},
      l_swfl_swrear: { from:"SW_FL", to:"SW_REAR", entries:[
        {index:0,gate_mask:"00000001",start_us:0,end_us:7.12,duration_us:7.12,note:"BE (TC0)"},
        {index:1,gate_mask:"10000000",start_us:7.12,end_us:11.24,duration_us:4.12,note:"f_radar_f#0"},
        {index:2,gate_mask:"10000000",start_us:11.24,end_us:15.36,duration_us:4.12,note:"f_radar_flc#0"},
        {index:3,gate_mask:"00000001",start_us:15.36,end_us:43.296,duration_us:27.936,note:"BE (TC0)"},
        {index:4,gate_mask:"00000000",start_us:43.296,end_us:55.6,duration_us:12.304,note:"guard"},
        {index:5,gate_mask:"00100000",start_us:55.6,end_us:108.2,duration_us:52.6,note:"f_lidar_fc#0"},
        {index:6,gate_mask:"01000000",start_us:108.2,end_us:161.36,duration_us:53.16,note:"f_lidar_fl#0"},
        {index:7,gate_mask:"00000001",start_us:161.36,end_us:241.296,duration_us:79.936,note:"BE (TC0)"},
        {index:8,gate_mask:"00000000",start_us:241.296,end_us:253.6,duration_us:12.304,note:"guard"},
        {index:9,gate_mask:"00100000",start_us:253.6,end_us:306.2,duration_us:52.6,note:"f_lidar_fc#1"},
        {index:10,gate_mask:"00000001",start_us:306.2,end_us:494.816,duration_us:188.616,note:"BE (TC0)"},
        {index:11,gate_mask:"00000000",start_us:494.816,end_us:507.12,duration_us:12.304,note:"guard"},
        {index:12,gate_mask:"10000000",start_us:507.12,end_us:511.24,duration_us:4.12,note:"f_radar_f#1"},
        {index:13,gate_mask:"10000000",start_us:511.24,end_us:515.36,duration_us:4.12,note:"f_radar_flc#1"},
        {index:14,gate_mask:"00001000",start_us:515.36,end_us:519.48,duration_us:4.12,note:"f_radar_frc#1"},
        {index:15,gate_mask:"00000001",start_us:519.48,end_us:543.856,duration_us:24.376,note:"BE (TC0)"},
        {index:16,gate_mask:"00000000",start_us:543.856,end_us:556.16,duration_us:12.304,note:"guard"},
        {index:17,gate_mask:"01000000",start_us:556.16,end_us:609.32,duration_us:53.16,note:"f_lidar_fl#1"},
        {index:18,gate_mask:"00000001",start_us:609.32,end_us:612.32,duration_us:3,note:"BE (TC0)"},
        {index:19,gate_mask:"00010000",start_us:612.32,end_us:665.48,duration_us:53.16,note:"f_lidar_fr#1"},
        {index:20,gate_mask:"00100000",start_us:665.48,end_us:718.08,duration_us:52.6,note:"f_lidar_fc#3"},
        {index:21,gate_mask:"00000001",start_us:718.08,end_us:843.396,duration_us:125.316,note:"BE (TC0)"},
        {index:22,gate_mask:"00000000",start_us:843.396,end_us:855.7,duration_us:12.304,note:"guard"},
        {index:23,gate_mask:"00000010",start_us:855.7,end_us:908.3,duration_us:52.6,note:"f_lidar_r#4"},
        {index:24,gate_mask:"00000001",start_us:908.3,end_us:911.3,duration_us:3,note:"BE (TC0)"},
        {index:25,gate_mask:"00100000",start_us:911.3,end_us:963.9,duration_us:52.6,note:"f_lidar_fc#4"},
        {index:26,gate_mask:"00000001",start_us:963.9,end_us:1000,duration_us:36.1,note:"BE (TC0)"}
      ]},
      l_swfr_swrear: { from:"SW_FR", to:"SW_REAR", entries:[
        {index:0,gate_mask:"00000001",start_us:0,end_us:7.12,duration_us:7.12,note:"BE (TC0)"},
        {index:1,gate_mask:"00001000",start_us:7.12,end_us:11.24,duration_us:4.12,note:"f_radar_frc#0"},
        {index:2,gate_mask:"00000001",start_us:11.24,end_us:43.856,duration_us:32.616,note:"BE (TC0)"},
        {index:3,gate_mask:"00000000",start_us:43.856,end_us:56.16,duration_us:12.304,note:"guard"},
        {index:4,gate_mask:"00010000",start_us:56.16,end_us:110.32,duration_us:54.16,note:"f_lidar_fr#0"},
        {index:5,gate_mask:"00000001",start_us:110.32,end_us:498.996,duration_us:388.676,note:"BE (TC0)"},
        {index:6,gate_mask:"00000000",start_us:498.996,end_us:511.3,duration_us:12.304,note:"guard"},
        {index:7,gate_mask:"00100000",start_us:511.3,end_us:563.9,duration_us:52.6,note:"f_lidar_fc#2"},
        {index:8,gate_mask:"00000001",start_us:563.9,end_us:1000,duration_us:436.1,note:"BE (TC0)"}
      ]},
      l_swrear_swfl: { from:"SW_REAR", to:"SW_FL", entries:[
        {index:0,gate_mask:"00000001",start_us:0,end_us:1000,duration_us:1000,note:"BE (TC0)"}
      ]},
      l_swrear_swfr: { from:"SW_REAR", to:"SW_FR", entries:[
        {index:0,gate_mask:"00000001",start_us:0,end_us:1000,duration_us:1000,note:"BE (TC0)"}
      ]},
      l_swrear_acu: { from:"SW_REAR", to:"ACU_IT", entries:[
        {index:0,gate_mask:"00000001",start_us:0,end_us:7.12,duration_us:7.12,note:"BE (TC0)"},
        {index:1,gate_mask:"00000100",start_us:7.12,end_us:11.24,duration_us:4.12,note:"f_radar_rlc#0"},
        {index:2,gate_mask:"00000100",start_us:11.24,end_us:15.36,duration_us:4.12,note:"f_radar_rrc#0"},
        {index:3,gate_mask:"10000000",start_us:15.36,end_us:19.48,duration_us:4.12,note:"f_radar_f#0"},
        {index:4,gate_mask:"10000000",start_us:19.48,end_us:23.5,duration_us:4.02,note:"f_radar_flc#0"},
        {index:5,gate_mask:"00001000",start_us:23.5,end_us:27.62,duration_us:4.12,note:"f_radar_frc#0"},
        {index:6,gate_mask:"00000001",start_us:27.62,end_us:43.296,duration_us:15.676,note:"BE (TC0)"},
        {index:7,gate_mask:"00000000",start_us:43.296,end_us:55.6,duration_us:12.304,note:"guard"},
        {index:8,gate_mask:"00000010",start_us:55.6,end_us:108.2,duration_us:52.6,note:"f_lidar_r#0"},
        {index:9,gate_mask:"00000001",start_us:108.2,end_us:111.2,duration_us:3,note:"BE (TC0)"},
        {index:10,gate_mask:"00100000",start_us:111.2,end_us:163.8,duration_us:52.6,note:"f_lidar_fc#0"},
        {index:11,gate_mask:"00010000",start_us:163.8,end_us:216.96,duration_us:53.16,note:"f_lidar_fr#0"},
        {index:12,gate_mask:"01000000",start_us:216.96,end_us:270.12,duration_us:53.16,note:"f_lidar_fl#0"},
        {index:13,gate_mask:"00000010",start_us:270.12,end_us:322.72,duration_us:52.6,note:"f_lidar_r#1"},
        {index:14,gate_mask:"00100000",start_us:322.72,end_us:375.32,duration_us:52.6,note:"f_lidar_fc#1"},
        {index:15,gate_mask:"00000001",start_us:375.32,end_us:443.396,duration_us:68.076,note:"BE (TC0)"},
        {index:16,gate_mask:"00000000",start_us:443.396,end_us:455.7,duration_us:12.304,note:"guard"},
        {index:17,gate_mask:"00000010",start_us:455.7,end_us:508.3,duration_us:52.6,note:"f_lidar_r#2"},
        {index:18,gate_mask:"00000100",start_us:508.3,end_us:512.42,duration_us:4.12,note:"f_radar_rlc#1"},
        {index:19,gate_mask:"00000100",start_us:512.42,end_us:516.54,duration_us:4.12,note:"f_radar_rrc#1"},
        {index:20,gate_mask:"10000000",start_us:516.54,end_us:520.66,duration_us:4.12,note:"f_radar_f#1"},
        {index:21,gate_mask:"10000000",start_us:520.66,end_us:524.78,duration_us:4.12,note:"f_radar_flc#1"},
        {index:22,gate_mask:"00001000",start_us:524.78,end_us:528.9,duration_us:4.12,note:"f_radar_frc#1"},
        {index:23,gate_mask:"00000001",start_us:528.9,end_us:554.596,duration_us:25.696,note:"BE (TC0)"},
        {index:24,gate_mask:"00000000",start_us:554.596,end_us:566.9,duration_us:12.304,note:"guard"},
        {index:25,gate_mask:"00100000",start_us:566.9,end_us:619.5,duration_us:52.6,note:"f_lidar_fc#2"},
        {index:26,gate_mask:"01000000",start_us:619.5,end_us:672.66,duration_us:53.16,note:"f_lidar_fl#1"},
        {index:27,gate_mask:"00010000",start_us:672.66,end_us:725.82,duration_us:53.16,note:"f_lidar_fr#1"},
        {index:28,gate_mask:"00100000",start_us:725.82,end_us:778.42,duration_us:52.6,note:"f_lidar_fc#3"},
        {index:29,gate_mask:"00000010",start_us:778.42,end_us:831.02,duration_us:52.6,note:"f_lidar_r#3"},
        {index:30,gate_mask:"00000001",start_us:831.02,end_us:843.396,duration_us:12.376,note:"BE (TC0)"},
        {index:31,gate_mask:"00000000",start_us:843.396,end_us:855.7,duration_us:12.304,note:"guard"},
        {index:32,gate_mask:"00000010",start_us:855.7,end_us:908.3,duration_us:52.6,note:"f_lidar_r#4"},
        {index:33,gate_mask:"00000001",start_us:908.3,end_us:911.3,duration_us:3,note:"BE (TC0)"},
        {index:34,gate_mask:"00100000",start_us:911.3,end_us:963.9,duration_us:52.6,note:"f_lidar_fc#4"},
        {index:35,gate_mask:"00000001",start_us:963.9,end_us:1000,duration_us:36.1,note:"BE (TC0)"}
      ]}
    }
  },
  stats: {
    constraints: 2293, variables: 1112, binaries: 989,
    tsn_packets: 24, status: "optimal", runtime_ms: 174034,
    fallback_packets: 0, overlap_conflicts: 0
  }
};
