import React, { useState, useEffect } from 'react';
import { getWorkerAvailabilityCalendar } from '../../services/api';

export default function WorkerAvailabilityCalendar() {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1); // 1-indexed
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const loadCalendar = async (year, month) => {
    try {
      setLoading(true);
      const res = await getWorkerAvailabilityCalendar(year, month);
      setDays(res.days || []);
    } catch {
      // Fallback build empty month days
      const daysCount = new Date(year, month, 0).getDate();
      const mockDays = [];
      for (let d = 1; d <= daysCount; d++) {
        mockDays.push({
          day: d,
          date: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
          status: 'available',
          color: 'green',
          title: 'Available for Work'
        });
      }
      setDays(mockDays);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalendar(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDay(null);
  };

  const getColorStyles = (color) => {
    switch (color) {
      case 'red':
        return { bg: '#fee2e2', border: '#f87171', text: '#991b1b', label: 'Booked' };
      case 'yellow':
        return { bg: '#fef3c7', border: '#fcd34d', text: '#92400e', label: 'Pending' };
      case 'grey':
        return { bg: '#f1f5f9', border: '#cbd5e1', text: '#475569', label: 'Leave / Off' };
      case 'green':
      default:
        return { bg: '#f0fdf4', border: '#86efac', text: '#166534', label: 'Available' };
    }
  };

  // Determine first day of month weekday offset (0 = Sunday, 1 = Monday, etc.)
  const firstDayWeekday = new Date(currentYear, currentMonth - 1, 1).getDay();

  return (
    <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.15rem', color: '#0f172a' }}>
            📅 My Availability & Commitment Calendar
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            Smart schedule view showing your accepted bookings, approved leaves, and available slots.
          </p>
        </div>

        {/* Month Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={handlePrevMonth}
            className="btn btn-outline btn-sm"
            style={{ padding: '0.35rem 0.65rem' }}
          >
            ← Prev
          </button>
          <strong style={{ fontSize: '0.95rem', minWidth: '130px', textAlign: 'center', color: '#1e293b' }}>
            {monthNames[currentMonth - 1]} {currentYear}
          </strong>
          <button
            onClick={handleNextMonth}
            className="btn btn-outline btn-sm"
            style={{ padding: '0.35rem 0.65rem' }}
          >
            Next →
          </button>
        </div>
      </div>

      {/* Visual Indicator Legend */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem', padding: '0.65rem 1rem', backgroundColor: '#f8fafc', borderRadius: '8px', fontSize: '0.8rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#86efac', border: '1px solid #16a34a' }} />
          <span><strong>Green:</strong> Available</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#f87171', border: '1px solid #dc2626' }} />
          <span><strong>Red:</strong> Booked</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#fcd34d', border: '1px solid #d97706' }} />
          <span><strong>Yellow:</strong> Pending Commitment / Cancellation</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#cbd5e1', border: '1px solid #64748b' }} />
          <span><strong>Grey:</strong> Approved Leave / Unavailable</span>
        </div>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>Loading calendar data…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.75rem', color: '#64748b', padding: '4px' }}>
              {d}
            </div>
          ))}

          {/* Empty offset padding cells */}
          {Array.from({ length: firstDayWeekday }).map((_, i) => (
            <div key={`empty-${i}`} style={{ opacity: 0 }} />
          ))}

          {days.map((item) => {
            const styles = getColorStyles(item.color);
            const isSelected = selectedDay?.date === item.date;
            return (
              <div
                key={item.date}
                onClick={() => setSelectedDay(item)}
                style={{
                  minHeight: '60px',
                  backgroundColor: styles.bg,
                  border: isSelected ? '2px solid #0f172a' : `1px solid ${styles.border}`,
                  borderRadius: '6px',
                  padding: '4px 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'transform 0.1s ease',
                  transform: isSelected ? 'scale(1.03)' : 'none'
                }}
              >
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: styles.text }}>
                  {item.day}
                </span>
                <span style={{ fontSize: '0.625rem', color: styles.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                  {item.title}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Day Drawer */}
      {selectedDay && (
        <div style={{ marginTop: '1.25rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#0f172a' }}>
              Schedule Details: {selectedDay.date}
            </h4>
            <button
              onClick={() => setSelectedDay(null)}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              ✕ Close
            </button>
          </div>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#334155' }}>
            Status: <strong>{selectedDay.title}</strong>
          </p>
          {selectedDay.details && (
            <pre style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', backgroundColor: '#ffffff', padding: '0.5rem', borderRadius: '4px', overflowX: 'auto' }}>
              {JSON.stringify(selectedDay.details, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
