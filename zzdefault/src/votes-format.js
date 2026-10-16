// votes-format.js

export function formatCount(n) {
  const num = Number(n) || 0;
  if (num < 1000) return String(num);

  const milhares = Math.floor(num / 1000);
  const decimo = Math.floor((num % 1000) / 100);

  if (decimo === 0) return `${milhares}k`;
  return `${milhares},${decimo}k`; 
}