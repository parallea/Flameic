import { evalValue, withPage } from './cdp-qa-utils.mjs';

const port = Number(process.argv[2] ?? 9223);

const controls = await withPage(port, async (send) =>
  evalValue(
    send,
    `Array.from(document.querySelectorAll('button,[role=button],input,textarea,select')).slice(0,220).map((el, i) => ({
      i,
      tag: el.tagName,
      text: (el.innerText || el.value || el.getAttribute('aria-label') || el.title || '').trim().slice(0, 160),
      disabled: Boolean(el.disabled),
      classes: String(el.className).slice(0, 100)
    }))`
  )
);

console.log(JSON.stringify(controls, null, 2));
