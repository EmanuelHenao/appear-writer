// Ajusta el tamaño de letra de cada caja [data-fit-box] para que su texto
// [data-fit-text] quepa entero, buscando el mayor tamaño posible entre
// data-fit-min y data-fit-max. Corre igual en la vista previa y en Chromium,
// por eso es una función autocontenida: no usa nada de fuera de su cuerpo.

export function autofitAll(root: ParentNode = document): number {
  const boxes = Array.from(root.querySelectorAll<HTMLElement>("[data-fit-box]"));
  let count = 0;
  for (const box of boxes) {
    const text = box.querySelector<HTMLElement>("[data-fit-text]");
    if (!text) continue;
    const max = parseFloat(box.dataset.fitMax || "120");
    const min = parseFloat(box.dataset.fitMin || "14");
    const fits = (size: number) => {
      text.style.fontSize = size + "px";
      return text.scrollHeight <= box.clientHeight + 1 && text.scrollWidth <= box.clientWidth + 1;
    };
    let lo = min;
    let hi = max;
    if (fits(hi)) {
      lo = hi;
    } else {
      for (let i = 0; i < 12 && hi - lo > 0.5; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid;
        else hi = mid;
      }
    }
    text.style.fontSize = Math.floor(lo * 10) / 10 + "px";
    count++;
  }
  return count;
}
