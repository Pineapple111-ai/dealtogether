import { useEffect, useState } from "react";

/** 장바구니 (브라우저 저장, 가격은 서버에서 매번 재계산) */
export type CartItem = {
  id: string;
  productId: string;
  skuId: string;
  addons: Record<string, string[]>;
  quantity: number;
  addedAt: number;
};

const KEY = "dt_cart_v1";
const EVENT = "dt-cart-change";
export const MAX_QTY = 10;

function isItem(v: unknown): v is CartItem {
  const i = v as CartItem;
  return !!i && typeof i.id === "string" && typeof i.productId === "string" && typeof i.skuId === "string"
    && typeof i.quantity === "number" && typeof i.addons === "object";
}

export function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter(isItem) : [];
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, 50)));
  } catch {
    /* 저장 공간 부족 등 */
  }
  window.dispatchEvent(new Event(EVENT));
}

function signature(skuId: string, addons: Record<string, string[]>) {
  const sorted = Object.keys(addons).sort().map((k) => [k, [...addons[k]].sort()]);
  return `${skuId}|${JSON.stringify(sorted)}`;
}

export function addToCart(input: { productId: string; skuId: string; addons: Record<string, string[]>; quantity: number }) {
  const items = readCart();
  const sig = signature(input.skuId, input.addons);
  const same = items.find((i) => signature(i.skuId, i.addons) === sig);
  if (same) {
    same.quantity = Math.min(same.quantity + input.quantity, MAX_QTY);
  } else {
    items.push({ ...input, id: crypto.randomUUID(), quantity: Math.min(input.quantity, MAX_QTY), addedAt: Date.now() });
  }
  writeCart(items);
}

export function updateCartQty(id: string, quantity: number) {
  writeCart(readCart().map((i) => (i.id === id ? { ...i, quantity: Math.min(Math.max(quantity, 1), MAX_QTY) } : i)));
}

export function removeFromCart(id: string) {
  writeCart(readCart().filter((i) => i.id !== id));
}

export function clearCart() {
  writeCart([]);
}

/** 장바구니 변경 구독 (다른 탭 포함) */
export function useCart() {
  const [items, setItems] = useState<CartItem[] | null>(null);
  useEffect(() => {
    const sync = () => setItems(readCart());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return items;
}