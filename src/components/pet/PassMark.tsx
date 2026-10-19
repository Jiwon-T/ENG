/** The pass badge beside a name: 펫 패스 a ribbon, 프리미엄 패스 a gold star (looks only). */
const PassMark = ({ plan }: { plan: string }) => plan === 'premium'
  ? <span title="프리미엄 패스" className="inline-flex items-center"><svg viewBox="-8 -8 16 16" width="16" height="16" aria-label="프리미엄 패스"><path d="M0 -7 l2 4.2 4.6.7 -3.3 3.2.8 4.6 -4.1 -2.2 -4.1 2.2.8 -4.6 -3.3 -3.2 4.6 -.7z" fill="#fbbf24" stroke="#ca8a04" strokeWidth=".8" /></svg></span>
  : <span title="펫 패스" className="inline-flex items-center"><svg viewBox="-9 -8 18 16" width="16" height="14" aria-label="펫 패스"><path d="M0 0 L-8 -6 L-8 6Z M0 0 L8 -6 L8 6Z" fill="#f472b6" /><circle r="2.2" fill="#e0587a" /></svg></span>;
export default PassMark;
