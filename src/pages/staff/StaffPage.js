export default function StaffPage() {
  const staff = [
    { name:'Rahul Patil',  role:'manager', email:'rahul@bambini.com', active:true  },
    { name:'Priya More',   role:'captain', email:'priya@bambini.com',  active:true  },
    { name:'Arun Desai',   role:'captain', email:'arun@bambini.com',   active:true  },
    { name:'Sneha Jadhav', role:'biller',  email:'sneha@bambini.com',  active:false },
  ]
  const roleColors = { owner:'#7C3AED', manager:'#1D4ED8', captain:'#0F766E', biller:'#B45309' }
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#1E293B', margin:0 }}>Staff</h1>
          <p style={{ color:'#64748B', fontSize:14, marginTop:4 }}>Manage staff accounts and roles</p>
        </div>
        <button style={{ background:'#7C3AED', color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:700, cursor:'pointer' }}>+ Invite Staff</button>
      </div>
      <div style={{ background:'#fff', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
        {staff.map((s,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', padding:'14px 20px', borderBottom: i<staff.length-1 ? '1px solid #F1F5F9' : 'none', gap:14 }}>
            <div style={{ width:40, height:40, borderRadius:'50%', background: roleColors[s.role]+'22', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:roleColors[s.role] }}>{s.name[0]}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:14, color:'#1E293B' }}>{s.name}</div>
              <div style={{ fontSize:12, color:'#94A3B8' }}>{s.email}</div>
            </div>
            <span style={{ background:roleColors[s.role]+'22', color:roleColors[s.role], padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, textTransform:'capitalize' }}>{s.role}</span>
            <span style={{ background: s.active ? '#DCFCE7' : '#F1F5F9', color: s.active ? '#15803D' : '#94A3B8', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{s.active ? 'Active' : 'Inactive'}</span>
            <button style={{ background:'#F1F5F9', border:'none', borderRadius:6, padding:'5px 12px', fontSize:12, cursor:'pointer', color:'#64748B' }}>Edit</button>
          </div>
        ))}
      </div>
    </div>
  )
}
