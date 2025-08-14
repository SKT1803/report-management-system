import "./Alert.css";

// suan kullanılmıyor
export default function Alert({ type = "info", children, onClose }) {
  return (
    <div className={`alert ${type}`}>
      <div className="alert__text">{children}</div>
      {onClose && (
        <button className="alert__close" onClick={onClose}>
          ×
        </button>
      )}
    </div>
  );
}
