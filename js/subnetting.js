/* subnetting.js — IPv4 subnetting calculator */

function initSubnetting() {
  const form = document.getElementById('subnet-form');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const ip = document.getElementById('subnet-ip').value.trim();
    const prefix = parseInt(document.getElementById('subnet-prefix').value.trim(), 10);
    if (!validateIP(ip)) {
      document.getElementById('subnet-output').innerHTML =
        '<div class="callout callout-red"><div class="callout-title">Invalid Input</div>Enter a valid IPv4 address (e.g., 192.168.1.0)</div>';
      return;
    }
    const result = calculateSubnet(ip, prefix);
    displaySubnetResult(result);
  });

  const hostsForm = document.getElementById('hosts-form');
  if (hostsForm) {
    hostsForm.addEventListener('submit', e => {
      e.preventDefault();
      const hosts = parseInt(document.getElementById('host-count').value, 10);
      if (isNaN(hosts) || hosts < 1) {
        document.getElementById('hosts-result').textContent = 'Enter a valid number of hosts.';
        return;
      }
      const prefix = minPrefixForHosts(hosts);
      const usable = Math.pow(2, 32 - prefix) - 2;
      document.getElementById('hosts-result').innerHTML =
        `<span class="callout callout-green" style="display:inline-block;padding:0.5rem 1rem;">
          Minimum prefix: <strong>/${prefix}</strong> &nbsp;|&nbsp; Usable hosts: <strong>${usable.toLocaleString()}</strong>
        </span>`;
    });
  }
}

function validateIP(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => {
    const n = parseInt(p, 10);
    return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p;
  });
}

function ipToNum(ip) {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
}

function numToIp(num) {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255
  ].join('.');
}

function calculateSubnet(ip, prefix) {
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return null;
  const ipNum = ipToNum(ip);
  const maskNum = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
  const networkNum = (ipNum & maskNum) >>> 0;
  const broadcastNum = prefix === 32 ? networkNum : (networkNum | (~maskNum >>> 0)) >>> 0;

  let firstUsable, lastUsable, hosts, note;
  if (prefix === 32) {
    firstUsable = numToIp(networkNum);
    lastUsable = numToIp(networkNum);
    hosts = 1;
    note = 'Host route — single host only (/32)';
  } else if (prefix === 31) {
    firstUsable = numToIp(networkNum);
    lastUsable = numToIp(broadcastNum);
    hosts = 2;
    note = 'Point-to-point link (RFC 3021) — no traditional broadcast address';
  } else {
    firstUsable = numToIp(networkNum + 1);
    lastUsable = numToIp(broadcastNum - 1);
    hosts = Math.pow(2, 32 - prefix) - 2;
    note = null;
  }

  const maskBinary = Array.from({ length: 4 }, (_, i) => {
    const byte = (maskNum >>> (24 - i * 8)) & 255;
    return byte.toString(2).padStart(8, '0');
  }).join('.');

  const wildcardNum = (~maskNum) >>> 0;
  const totalAddresses = Math.pow(2, 32 - prefix);

  return {
    network: numToIp(networkNum),
    broadcast: prefix >= 31 ? (prefix === 32 ? 'N/A (host route)' : 'N/A (P2P)') : numToIp(broadcastNum),
    firstUsable,
    lastUsable,
    hosts,
    mask: numToIp(maskNum),
    wildcard: numToIp(wildcardNum),
    maskBinary,
    prefix,
    totalAddresses,
    note
  };
}

function minPrefixForHosts(hosts) {
  for (let prefix = 30; prefix >= 1; prefix--) {
    if (Math.pow(2, 32 - prefix) - 2 >= hosts) continue;
    return prefix + 1;
  }
  return 1;
}

function displaySubnetResult(r) {
  const out = document.getElementById('subnet-output');
  if (!r) {
    out.innerHTML = '<div class="callout callout-red"><div class="callout-title">Error</div>Invalid IP address or prefix length (0–32).</div>';
    return;
  }
  out.innerHTML = `
    <div class="table-wrap" style="margin-top:1rem;">
      <table>
        <thead><tr><th>Field</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>Network Address</td><td><code>${r.network}/${r.prefix}</code></td></tr>
          <tr><td>Subnet Mask</td><td><code>${r.mask}</code></td></tr>
          <tr><td>Wildcard Mask</td><td><code>${r.wildcard}</code></td></tr>
          <tr><td>Broadcast Address</td><td><code>${r.broadcast}</code></td></tr>
          <tr><td>First Usable Host</td><td><code>${r.firstUsable}</code></td></tr>
          <tr><td>Last Usable Host</td><td><code>${r.lastUsable}</code></td></tr>
          <tr><td>Usable Hosts</td><td><strong>${r.hosts.toLocaleString()}</strong></td></tr>
          <tr><td>Total Addresses</td><td>${r.totalAddresses.toLocaleString()}</td></tr>
          <tr><td>Mask (binary)</td><td><code style="font-size:11px;word-break:break-all;">${r.maskBinary}</code></td></tr>
          <tr><td>CIDR Prefix</td><td><code>/${r.prefix}</code></td></tr>
        </tbody>
      </table>
    </div>
    ${r.note ? `<div class="callout callout-amber" style="margin-top:0.75rem;"><div class="callout-title">Note</div>${r.note}</div>` : ''}
  `;
}
