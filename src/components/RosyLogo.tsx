/** The pen-nib logo recoloured to the app's rosy palette (same nib as the original; screens after login use it, the
 *  login screen keeps the original). public/icons/icon-rosy-192.png is made from icon-192.png by keeping each pixel's
 *  white/purple mix and swapping the purple for a rose gradient (#f08c93 → #d26272). */
/** The rose nib alone on a light pink tile (login screen and loading screens). */
export function NibTile({size = 72, className = ''}: {size?: number; className?: string}) {
  return <span className={`flex items-center justify-center rounded-[30%] bg-[#fdecef] ${className}`} style={{width: size, height: size}}><img src="/icons/nib-rose-192.png" alt="" width={Math.round(size * 0.61)} height={Math.round(size * 0.61)} /></span>;
}
export default function RosyLogo({size = 32, className = ''}: {size?: number; className?: string}) {
  return <img src="/icons/icon-rosy-192.png" alt="" width={size} height={size} className={`rounded-[22%] ${className}`} />;
}
