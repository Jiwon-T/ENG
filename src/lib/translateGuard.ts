// A page translator (or an extension) can wrap the page's text in its own tags. React then tries to remove or insert
// next to a text node that is no longer where it left it, throws, and the whole app falls to the error screen (펫 탑,
// 원정대 answers). The page asks not to be translated (index.html); if it is anyway, skip those moves instead of crashing.
export function guardDomAgainstTranslators() {
  if (typeof Node !== 'function' || !Node.prototype) return;
  const proto = Node.prototype as any;
  if (proto.__translateGuard) return;
  proto.__translateGuard = true;
  const removeChild = proto.removeChild, insertBefore = proto.insertBefore;
  proto.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) { console.warn('Skipped removing a node moved by a page translator'); return child; }
    return removeChild.call(this, child);
  };
  proto.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) { console.warn('Skipped inserting before a node moved by a page translator'); return node; }
    return insertBefore.call(this, node, ref);
  };
}
guardDomAgainstTranslators();
