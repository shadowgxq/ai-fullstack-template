// Rendered sRGB composition, evaluated inside the actual tested page.
function renderedContrast() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  function rgba(color) { context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data].map((x, i) => i === 3 ? x / 255 : x); }
  function over(fg, bg) { return [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1); }
  function background(node) { const chain = []; for (let n = node; n; n = n.parentElement) chain.unshift(n); return chain.reduce((color, n) => over(rgba(getComputedStyle(n).backgroundColor), color), [255, 255, 255, 1]); }
  function lum(color) { return color.slice(0, 3).map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((s, x, i) => s + x * [.2126, .7152, .0722][i], 0); }
  function ratio(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
  const samples = [];
  for (const node of document.querySelectorAll('h1,h2,h3,p,label,button,a,input,textarea,[role=alert],[role=status]')) {
    const style = getComputedStyle(node), bounds = node.getBoundingClientRect();
    if (!bounds.width || !bounds.height || style.visibility === 'hidden' || style.opacity !== '1' || node.disabled || node.getAttribute('aria-disabled') === 'true' || node.closest('[aria-hidden="true"]')) continue;
    const text = node.matches('input,textarea') ? node.value || node.placeholder : [...node.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join('').trim();
    if (!text) continue;
    const foreground = node.matches('input,textarea') && !node.value ? getComputedStyle(node, '::placeholder').color : style.color;
    const bg = background(node), fg = over(rgba(foreground), bg);
    samples.push({ kind: 'text', tag: node.tagName, text: text.slice(0, 60), foreground, background: bg, ratio: ratio(fg, bg), minimum: 4.5 });
  }
  for (const node of document.querySelectorAll('input:not([type=checkbox]),textarea,[role=combobox]')) {
    const style=getComputedStyle(node), bounds=node.getBoundingClientRect();
    if(!bounds.width||!bounds.height||node.disabled||node.closest('[aria-hidden="true"]')||style.visibility==='hidden')continue;
    if(parseFloat(style.borderTopWidth)>0&&style.borderTopStyle!=='none'){
      const bg=background(node.parentElement),border=over(rgba(style.borderTopColor),bg);
      samples.push({kind:'control-border',tag:node.tagName,name:node.getAttribute('aria-label')||node.name,foreground:style.borderTopColor,background:bg,ratio:ratio(border,bg),minimum:3});
    }
  }
  const focused=document.activeElement;
  if(focused&&focused.matches(':focus-visible')){
    const style=getComputedStyle(focused),bg=background(focused.parentElement);
    const colors=style.boxShadow.match(/rgba?\([^)]+\)|oklch\([^)]+\)|oklab\([^)]+\)|color\([^)]+\)/g)||[];
    if(parseFloat(style.outlineWidth)>0&&style.outlineStyle!=='none')colors.push(style.outlineColor);
    samples.push({kind:'focus-indicator',tag:focused.tagName,boxShadow:style.boxShadow,outline:style.outline,background:bg,ratio:Math.max(0,...colors.map(c=>ratio(over(rgba(c),bg),bg))),minimum:3});
  }
  return samples;
}
module.exports = { renderedContrast };
