const NODES = {
  tv: '<path d="m17 2-5 5-5-5"></path><rect width="20" height="15" x="2" y="7" rx="2"></rect>',
  plus: '<path d="M5 12h14"></path><path d="M12 5v14"></path>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
  hamburger: '<path d="M12 16H4a2 2 0 1 1 0-4h16a2 2 0 1 1 0 4h-4.25"></path><path d="M5 12a2 2 0 0 1-2-2 9 7 0 0 1 18 0 2 2 0 0 1-2 2"></path><path d="M5 16a2 2 0 0 0-2 2 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 2 2 0 0 0-2-2q0 0 0 0"></path><path d="m6.67 12 6.13 4.6a2 2 0 0 0 2.8-.4l3.15-4.2"></path>',
  'chevron-down': '<path d="m6 9 6 6 6-6"></path>',
  'chevron-up': '<path d="m18 15-6-6-6 6"></path>',
  x: '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
  'arrow-left': '<path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path>',
};

export function icon(name, { size = 20, className = '', label = '' } = {}) {
  const nodes = NODES[name] ?? '';
  const aria = label ? ` role="img" aria-label="${escapeAttribute(label)}"` : ' aria-hidden="true"';
  return `<svg data-icon="${escapeAttribute(name)}" class="lucide-icon ${escapeAttribute(className)}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${aria}>${nodes}</svg>`;
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
