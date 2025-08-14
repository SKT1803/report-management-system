import { getUser, logout } from '../../utils/auth'
import './TopBar.css'

export default function TopBar() {
  const user = getUser()
  return (
    <div className="topbar">
      <div className="brandWrap">
        <strong className="brand">Prime Report</strong>
        <span className="welcome">
          {/* {user ? `Hoş geldin, ${user.name} (${user.department || user.role})` : ''} */}
            {user ? `Hoş geldin, ${user.name} ` : ''}
        </span>
      </div>
      <button className="logoutBtn" onClick={logout}>Logout</button>
    </div>
  )
}
