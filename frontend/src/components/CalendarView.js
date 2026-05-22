import { useState, useEffect } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Plus, X, Clock, Loader2, Calendar, Trash2 } from 'lucide-react';

import API from '@/config/api';

const eventTypeColors = {
  general: '#64748B', appointment: '#4E9FE5', reminder: '#FFB627',
  activity: '#10B981', selfcare: '#FF715B', school: '#8B5CF6'
};

const eventTypes = [
  { value: 'general', label: 'General' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'activity', label: 'Activity' },
  { value: 'selfcare', label: 'Self-Care' },
  { value: 'school', label: 'School' },
];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarView() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);
  const [events, setEvents] = useState([]);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', description: '', start_time: '', end_time: '', event_type: 'general', reminder: false });

  const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const monthName = new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' });

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth, currentYear]);

  const loadEvents = async () => {
    try {
      const res = await axios.get(`${API}/calendar/events?month=${monthStr}`, { withCredentials: true });
      setEvents(res.data);
    } catch (err) { console.error(err); }
  };

  const addEvent = async () => {
    if (!newEvent.title.trim() || !newEvent.start_time) return;
    setSaving(true);
    try {
      await axios.post(`${API}/calendar/events`, newEvent, { withCredentials: true });
      setShowAddEvent(false);
      setNewEvent({ title: '', description: '', start_time: '', end_time: '', event_type: 'general', reminder: false });
      loadEvents();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const deleteEvent = async (eventId) => {
    try {
      await axios.delete(`${API}/calendar/events/${eventId}`, { withCredentials: true });
      loadEvents();
    } catch (err) { console.error(err); }
  };

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  const getEventsForDay = (day) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((e) => e.start_time?.startsWith(dateStr));
  };

  const selectedDateStr = selectedDate ? `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}` : '';
  const selectedEvents = selectedDate ? getEventsForDay(selectedDate) : [];
  const isToday = (day) => day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-5xl mx-auto" data-testid="calendar-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-['Outfit'] text-2xl md:text-3xl font-bold text-slate-900">Calendar</h1>
          <p className="text-slate-500 mt-1">Stay organized, stay on top of it.</p>
        </div>
        <button
          onClick={() => {
            setShowAddEvent(true);
            if (selectedDate) {
              setNewEvent(prev => ({
                ...prev,
                start_time: `${selectedDateStr}T09:00`
              }));
            }
          }}
          className="flex items-center gap-2 bg-[#FF715B] text-white px-4 py-2.5 rounded-2xl hover:bg-[#FF573D] shadow-[0_4px_14px_0_rgba(255,113,91,0.3)] transition-all text-sm font-medium"
          data-testid="add-event-btn"
        >
          <Plus className="w-4 h-4" /> Add Event
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]" data-testid="calendar-grid">
          <div className="flex items-center justify-between mb-6">
            <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-slate-50 transition-colors" data-testid="prev-month-btn">
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h2 className="font-['Outfit'] text-lg font-semibold text-slate-900">{monthName}</h2>
            <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-slate-50 transition-colors" data-testid="next-month-btn">
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-center text-[11px] font-medium text-slate-400 py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {blanks.map((b) => <div key={`blank-${b}`} />)}
            {days.map((day) => {
              const dayEvents = getEventsForDay(day);
              const selected = selectedDate === day;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(day)}
                  className={`relative p-2 rounded-xl text-sm transition-all min-h-[44px] flex flex-col items-center ${
                    selected ? 'bg-[#FF715B] text-white shadow-md' :
                    isToday(day) ? 'bg-[#FF715B]/10 text-[#FF715B] font-semibold' :
                    'text-slate-700 hover:bg-slate-50'
                  }`}
                  data-testid={`calendar-day-${day}`}
                >
                  <span>{day}</span>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-0.5 mt-1">
                      {dayEvents.slice(0, 3).map((e) => (
                        <div
                          key={e.event_id || e.title}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: selected ? 'white' : (eventTypeColors[e.event_type] || '#64748B') }}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Events Panel */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]" data-testid="events-panel">
          <h3 className="font-['Outfit'] font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#4E9FE5]" />
            {selectedDate ? new Date(currentYear, currentMonth, selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : 'Select a day'}
          </h3>
          {selectedDate ? (
            selectedEvents.length > 0 ? (
              <div className="space-y-3">
                {selectedEvents.map((e) => (
                  <div key={e.event_id} className="p-3 rounded-xl bg-slate-50 group" data-testid={`event-${e.event_id}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: eventTypeColors[e.event_type] || '#64748B' }} />
                        <p className="text-sm font-medium text-slate-800">{e.title}</p>
                      </div>
                      <button onClick={() => deleteEvent(e.event_id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all" data-testid={`delete-event-${e.event_id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {e.description && <p className="text-xs text-slate-500 ml-4.5 pl-[18px]">{e.description}</p>}
                    {e.start_time && (
                      <p className="text-[10px] text-slate-400 pl-[18px] mt-1">
                        {new Date(e.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {e.end_time ? ` - ${new Date(e.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No events this day</p>
                <button
                  onClick={() => {
                    setShowAddEvent(true);
                    setNewEvent(prev => ({ ...prev, start_time: `${selectedDateStr}T09:00` }));
                  }}
                  className="text-sm text-[#FF715B] font-medium mt-2 hover:underline"
                  data-testid="add-event-for-day-btn"
                >
                  Add one
                </button>
              </div>
            )
          ) : (
            <div className="text-center py-8">
              <Calendar className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Click a day to see events</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" data-testid="add-event-modal">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-['Outfit'] text-xl font-bold text-slate-900">New Event</h2>
              <button onClick={() => setShowAddEvent(false)} className="p-2 rounded-xl hover:bg-slate-50 text-slate-400" data-testid="close-event-modal-btn">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Event title"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 outline-none text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#FF715B]/20"
                data-testid="event-title-input"
              />
              <textarea
                placeholder="Description (optional)"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                rows={2}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 outline-none text-sm text-slate-800 placeholder-slate-400 resize-none focus:ring-2 focus:ring-[#FF715B]/20"
                data-testid="event-description-input"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Start</label>
                  <input
                    type="datetime-local"
                    value={newEvent.start_time}
                    onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 outline-none text-sm text-slate-800 focus:ring-2 focus:ring-[#FF715B]/20"
                    data-testid="event-start-input"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">End (optional)</label>
                  <input
                    type="datetime-local"
                    value={newEvent.end_time}
                    onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 outline-none text-sm text-slate-800 focus:ring-2 focus:ring-[#FF715B]/20"
                    data-testid="event-end-input"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-2 block">Type</label>
                <div className="flex flex-wrap gap-2" data-testid="event-type-selector">
                  {eventTypes.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setNewEvent({ ...newEvent, event_type: t.value })}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        newEvent.event_type === t.value
                          ? 'text-white shadow-md'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                      style={newEvent.event_type === t.value ? { background: eventTypeColors[t.value] } : {}}
                      data-testid={`event-type-${t.value}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newEvent.reminder}
                  onChange={(e) => setNewEvent({ ...newEvent, reminder: e.target.checked })}
                  className="rounded accent-[#FF715B]"
                  data-testid="event-reminder-checkbox"
                />
                <span className="text-sm text-slate-600">Set reminder</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddEvent(false)}
                className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all text-sm font-medium"
                data-testid="cancel-event-btn"
              >
                Cancel
              </button>
              <button
                onClick={addEvent}
                disabled={!newEvent.title.trim() || !newEvent.start_time || saving}
                className="flex-1 px-4 py-3 rounded-2xl bg-[#FF715B] text-white hover:bg-[#FF573D] disabled:opacity-40 transition-all text-sm font-medium flex items-center justify-center gap-2"
                data-testid="save-event-btn"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
