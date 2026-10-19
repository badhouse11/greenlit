/** The thin running strip that points to the card game. Set VITE_SHOP_URL in Netlify. */
const SHOP_URL: string = import.meta.env.VITE_SHOP_URL ?? '';

export function ShopStrip() {
  const text = SHOP_URL
    ? 'Now showing: the limited edition GREENLIT card game. Get your copy here.'
    : 'Now showing: the limited edition GREENLIT card game. Coming soon to a table near you.';
  const run = (
    <span className="shop-strip__run" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <span key={i}>
          {text}
          <span className="shop-strip__star">★</span>
        </span>
      ))}
    </span>
  );
  const body = (
    <>
      <span className="visually-hidden">{text}</span>
      <span className="shop-strip__track">
        {run}
        {run}
      </span>
    </>
  );
  return SHOP_URL ? (
    <a className="shop-strip no-print" href={SHOP_URL} target="_blank" rel="noopener">
      {body}
    </a>
  ) : (
    <div className="shop-strip no-print">{body}</div>
  );
}
