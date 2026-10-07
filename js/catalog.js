/* catalog.js — every certification, its sidebar, and every routable page.
   nav.js renders the sidebar from this; tools/ read it to find every route. */

export const CERTS = [
  {
    key: 'netplus',
    label: 'CompTIA Network+',
    crumb: 'Net+ N10-009',
    home: 'netplus/overview',
    before: [{ path: 'netplus/overview', label: '📊 Exam Overview', className: 'sidebar-link nav-overview' }],
    domains: [
      {
        title: 'Domain 1: Networking Concepts', weight: 23, open: true,
        objectives: [
          ['netplus/domain1/obj-1-1', '1.1 OSI & Network Models'],
          ['netplus/domain1/obj-1-2', '1.2 Networking Devices'],
          ['netplus/domain1/obj-1-3', '1.3 Cloud Concepts'],
          ['netplus/domain1/obj-1-4', '1.4 Ports & Protocols'],
          ['netplus/domain1/obj-1-5', '1.5 Cables & Media'],
          ['netplus/domain1/obj-1-6', '1.6 Topologies & Architectures'],
          ['netplus/domain1/obj-1-7', '1.7 IPv4 & Subnetting'],
          ['netplus/domain1/obj-1-8', '1.8 Modern Environments'],
        ],
      },
      {
        title: 'Domain 2: Network Implementation', weight: 20,
        objectives: [
          ['netplus/domain2/obj-2-1', '2.1 Routing Technologies'],
          ['netplus/domain2/obj-2-2', '2.2 Switching & VLANs'],
          ['netplus/domain2/obj-2-3', '2.3 Wireless Standards'],
          ['netplus/domain2/obj-2-4', '2.4 Physical Installation'],
        ],
      },
      {
        title: 'Domain 3: Network Operations', weight: 19,
        objectives: [
          ['netplus/domain3/obj-3-1', '3.1 Organizational Processes & Procedures'],
          ['netplus/domain3/obj-3-2', '3.2 Network Monitoring Technologies'],
          ['netplus/domain3/obj-3-3', '3.3 Disaster Recovery Concepts'],
          ['netplus/domain3/obj-3-4', '3.4 IPv4 & IPv6 Network Services'],
          ['netplus/domain3/obj-3-5', '3.5 Network Access & Management Methods'],
        ],
      },
      {
        title: 'Domain 4: Network Security', weight: 14,
        objectives: [
          ['netplus/domain4/obj-4-1', '4.1 Security Concepts'],
          ['netplus/domain4/obj-4-2', '4.2 Attack Types'],
          ['netplus/domain4/obj-4-3', '4.3 Hardening & Defense'],
        ],
      },
      {
        title: 'Domain 5: Network Troubleshooting', weight: 24,
        objectives: [
          ['netplus/domain5/obj-5-1', '5.1 Troubleshooting Methodology'],
          ['netplus/domain5/obj-5-2', '5.2 Cable & Physical Issues'],
          ['netplus/domain5/obj-5-3', '5.3 Network Issues'],
          ['netplus/domain5/obj-5-4', '5.4 Performance Troubleshooting'],
          ['netplus/domain5/obj-5-5', '5.5 Tools & Protocols'],
        ],
      },
      {
        title: 'PBQ Lab',
        objectives: [
          ['netplus/pbq/overview', 'How PBQs Work'],
          ['netplus/pbq/subnet-calculator', 'Subnet Calculator & Drill'],
          ['netplus/pbq/cli-troubleshooting', 'CLI Troubleshooting Labs'],
          ['netplus/pbq/ip-addressing', 'IP Addressing & VLSM'],
          ['netplus/pbq/routing', 'Routing Tables'],
          ['netplus/pbq/switch-vlans', 'Switch Ports & VLANs'],
          ['netplus/pbq/firewall-rules', 'Firewall Rules'],
          ['netplus/pbq/wireless', 'Wireless AP Configuration'],
          ['netplus/pbq/cabling-placement', 'Cabling & Device Placement'],
          ['netplus/pbq/tools', 'Tools & Cable Faults'],
          ['netplus/pbq/ports-methodology', 'Ports & Methodology'],
        ],
      },
    ],
    after: [{ path: 'netplus/study-plans', label: '📅 Study Plans', className: 'sidebar-study-plans', divider: true }],
  },
  {
    key: 'secplus',
    label: 'CompTIA Security+',
    crumb: 'Sec+ SY0-701',
    home: 'secplus/stub',
    note: 'Content coming soon.',
  },
  {
    key: 'az104',
    label: 'Microsoft AZ-104',
    crumb: 'AZ-104',
    home: 'az104/az900-cram',
    before: [{ path: 'az104/az900-cram', label: '☁️ AZ-900 Prerequisite Cram', className: 'obj-link' }],
  },
];

/* Pages reachable without a sidebar entry. */
export const EXTRA_ROUTES = ['home', 'secplus/stub'];

/* Old routes that still resolve, so bookmarks keep working. */
export const ALIASES = { 'az104/stub': 'az104/az900-cram' };

export const ROUTES = [
  ...EXTRA_ROUTES,
  ...CERTS.flatMap(c => [
    ...(c.before || []).map(l => l.path),
    ...(c.domains || []).flatMap(d => d.objectives.map(([p]) => p)),
    ...(c.after || []).map(l => l.path),
  ]),
].filter((r, i, all) => all.indexOf(r) === i);
