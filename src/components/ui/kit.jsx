export const Btn=({children,variant='solid',className='',...p})=>{
  const base='px-4 py-3 rounded-xl text-sm font-semibold ';
  const styles=variant==='solid'?'bg-primary text-white hover:opacity-90':'border bg-white hover:bg-slate-50';
  return <button className={base+styles+' '+className} {...p}>{children}</button>
}
export const Table=({children})=> <div className='overflow-x-auto'><table className='min-w-full text-sm'>{children}</table></div>
export const Th=({children, ...p})=> <th {...p} className={'p-2 text-left text-slate-600 ' + (p.className||'')}>{children}</th>
export const Td=({children, ...p})=> <td {...p} className={'p-2 align-top ' + (p.className||'')}>{children}</td>
export const Section=({title,children})=>(<div className='bg-white rounded-2xl shadow p-6'><h2 className='text-xl font-semibold mb-4'>{title}</h2>{children}</div>)
export const Chip=({children})=> <span className='text-xs border rounded-full px-2 py-1 mr-1'>{children}</span>
