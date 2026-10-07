/* binary-bits.js — clickable binary place-value grid (obj-1-7) */

export function initBinaryBits() {
  const grid = document.getElementById('bit-grid');
  const totalDisplay = document.getElementById('bit-total');
  if (!grid || !totalDisplay) return;

  function updateTotal() {
    let total = 0;
    grid.querySelectorAll('.binary-bit-cell').forEach(cell => {
      if (cell.classList.contains('bit-on')) total += parseInt(cell.dataset.value, 10);
    });
    totalDisplay.textContent = total;
  }

  grid.querySelectorAll('.binary-bit-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const isOn = cell.classList.toggle('bit-on');
      cell.textContent = isOn ? '1' : '0';
      updateTotal();
    });
  });

  updateTotal();
}
