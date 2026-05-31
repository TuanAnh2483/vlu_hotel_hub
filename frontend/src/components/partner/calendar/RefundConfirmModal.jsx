import { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Btn } from "../../admin/AdminLayout";
import { fmtCurrency } from "./calendarUtils";

export default function RefundConfirmModal({ pending, onConfirm, onCancel, loading }) {
  const [transferNote, setTransferNote] = useState("");

  if (!pending) return null;
  const isApprove = pending.type === "approve";

  function handleConfirm() {
    onConfirm(isApprove ? transferNote : null);
  }

  return (
    <div className="pcrc-overlay" role="dialog" aria-modal="true">
      <div className="pcrc-modal">
        <div className={`pcrc-icon ${isApprove ? "pcrc-icon--green" : "pcrc-icon--red"}`}>
          {isApprove
            ? <CheckCircle2 size={30} />
            : <XCircle     size={30} />
          }
        </div>

        <div className="pcrc-title">
          {isApprove ? "Xác nhận duyệt hoàn tiền?" : "Xác nhận từ chối hoàn tiền?"}
        </div>

        <div className="pcrc-body">
          {isApprove ? "Duyệt yêu cầu hoàn tiền từ " : "Từ chối yêu cầu từ "}
          <strong>{pending.refund.userEmail}</strong>
          {" — số tiền "}
          <strong style={{ color: isApprove ? "#059669" : "#BE1E2E" }}>
            {fmtCurrency(pending.refund.amount)}
          </strong>
          .
        </div>

        {isApprove && (
          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
              Mã giao dịch chuyển khoản <span style={{ color: "#9ca3af", fontWeight: 400 }}>(tuỳ chọn)</span>
            </label>
            <input
              value={transferNote}
              onChange={e => setTransferNote(e.target.value)}
              placeholder="VD: FT26140123456"
              style={{ width: "100%", padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
            />
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
              Khách hàng sẽ thấy mã này làm bằng chứng hoàn tiền.
            </div>
          </div>
        )}

        {!isApprove && (
          <div className="pcrc-warn">
            <AlertTriangle size={12} style={{ flexShrink: 0 }} />
            Thao tác từ chối không thể hoàn tác sau khi xác nhận.
          </div>
        )}

        <div className="pcrc-actions">
          <Btn variant="ghost" onClick={onCancel} disabled={loading}>
            Huỷ
          </Btn>
          <Btn
            variant={isApprove ? "success" : "danger"}
            loading={loading}
            onClick={handleConfirm}
          >
            {isApprove ? "Xác nhận duyệt" : "Xác nhận từ chối"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
