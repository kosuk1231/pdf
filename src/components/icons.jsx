const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
const wrap = (children) => (props) => (
  <svg viewBox="0 0 24 24" className="icon" aria-hidden="true" {...props}>{children}</svg>
)

export const IconOpen = wrap(<><path {...S} d="M4 5h6l2 2h8v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" /></>)
export const IconRotL = wrap(<><path {...S} d="M4 9a8 8 0 1 1 1 7" /><path {...S} d="M4 4v5h5" /></>)
export const IconRotR = wrap(<><path {...S} d="M20 9A8 8 0 1 0 19 16" /><path {...S} d="M20 4v5h-5" /></>)
export const IconTrash = wrap(<><path {...S} d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></>)
export const IconText = wrap(<><path {...S} d="M5 6h14M12 6v13M9 19h6" /></>)
export const IconSplit = wrap(<><circle {...S} cx="6" cy="6" r="2.4" /><circle {...S} cx="6" cy="18" r="2.4" /><path {...S} d="M8 7.5 20 16M8 16.5 20 8" /></>)
export const IconDownload = wrap(<><path {...S} d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" /></>)
export const IconUp = wrap(<><path {...S} d="M12 19V6m0 0-5 5m5-5 5 5" /></>)
export const IconDown = wrap(<><path {...S} d="M12 5v13m0 0 5-5m-5 5-5-5" /></>)
export const IconShield = wrap(<><path {...S} d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" /><path {...S} d="M9 12l2 2 4-4" /></>)
export const IconLoad = wrap(<><path {...S} d="M12 3a9 9 0 1 0 9 9" /></>)
export const IconPlus = wrap(<><path {...S} d="M12 5v14M5 12h14" /></>)
