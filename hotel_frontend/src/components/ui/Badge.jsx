const BADGE_MAP = {
  ACTIVE:          { bg: "var(--success-bg)",  color: "var(--success)",  label: "Hoạt động"      },
  LOCKED:          { bg: "var(--danger-bg)",   color: "var(--danger)",   label: "Bị khóa"        },
  INACTIVE:        { bg: "var(--secondary)",   color: "var(--text-light)", label: "Vô hiệu"      },
  DISABLED:        { bg: "var(--secondary)",   color: "var(--text-light)", label: "Vô hiệu"      },
  CONFIRMED:       { bg: "var(--info-bg)",     color: "var(--info)",     label: "Đã xác nhận"   },
  PENDING_PAYMENT: { bg: "var(--warning-bg)",  color: "var(--warning)",  label: "Chờ thanh toán" },
  CANCELLED:       { bg: "var(--secondary)",   color: "var(--text-muted)", label: "Đã hủy"       },
  COMPLETED:       { bg: "var(--success-bg)",  color: "var(--success)",  label: "Hoàn thành"    },
  PENDING:         { bg: "var(--warning-bg)",  color: "var(--warning)",  label: "Chờ duyệt"     },
  SUBMITTED:       { bg: "var(--warning-bg)",  color: "var(--warning)",  label: "Chờ duyệt"     },
  UNDER_REVIEW:    { bg: "var(--info-bg)",     color: "var(--info)",     label: "Đang xem xét"  },
  APPROVED:        { bg: "var(--success-bg)",  color: "var(--success)",  label: "Đã duyệt"      },
  REJECTED:        { bg: "var(--danger-bg)",   color: "var(--danger)",   label: "Từ chối"       },
  HIGH:            { bg: "var(--danger-bg)",   color: "var(--danger)",   label: "Cao"            },
  MEDIUM:          { bg: "var(--warning-bg)",  color: "var(--warning)",  label: "Trung bình"    },
  LOW:             { bg: "var(--success-bg)",  color: "var(--success)",  label: "Thấp"          },
  CUSTOMER:        { bg: "var(--info-bg)",     color: "var(--info)",     label: "Khách hàng"    },
  PARTNER:         { bg: "#f3e5f5",            color: "#6a1b9a",         label: "Đối tác"       },
  ADMIN:           { bg: "#fce4ec",            color: "#880e4f",         label: "Admin"         },
};

export default function Badge({ status }) {
  const s = BADGE_MAP[status] || { bg: "var(--secondary)", color: "var(--text-muted)", label: status };
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 20,
      background: s.bg, color: s.color, fontSize: 11, fontWeight: 700,
    }}>
      {s.label}
    </span>
  );
}

export { BADGE_MAP };
