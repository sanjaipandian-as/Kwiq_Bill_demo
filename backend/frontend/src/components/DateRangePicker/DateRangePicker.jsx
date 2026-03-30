import React, { useState, useEffect, useRef } from 'react';
import { Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import './DateRangePicker.css';

const DateRangePicker = ({ onDateRangeChange, value }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [startDate, setStartDate] = useState(value?.startDate || null);
    const [endDate, setEndDate] = useState(value?.endDate || null);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [hoveredDate, setHoveredDate] = useState(null);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        return { daysInMonth, startingDayOfWeek, year, month };
    };

    const handleDateClick = (date) => {
        if (!startDate || (startDate && endDate)) {
            // Start new selection
            setStartDate(date);
            setEndDate(null);
        } else {
            // Complete the range
            if (date < startDate) {
                setEndDate(startDate);
                setStartDate(date);
            } else {
                setEndDate(date);
            }
        }
    };

    const handleApply = () => {
        if (startDate && endDate) {
            onDateRangeChange({ startDate, endDate });
            setIsOpen(false);
        }
    };

    const handleClear = () => {
        setStartDate(null);
        setEndDate(null);
        onDateRangeChange(null);
        setIsOpen(false);
    };

    const handleQuickFilter = (days, preset = null) => {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        
        let start = new Date();
        
        if (preset === 'today') {
            start.setHours(0, 0, 0, 0);
        } else if (preset === 'thisMonth') {
            start = new Date(end.getFullYear(), end.getMonth(), 1);
            start.setHours(0, 0, 0, 0);
        } else if (preset === 'lastMonth') {
            start = new Date(end.getFullYear(), end.getMonth() - 1, 1);
            start.setHours(0, 0, 0, 0);
            end.setTime(new Date(end.getFullYear(), end.getMonth(), 0).getTime());
            end.setHours(23, 59, 59, 999);
        } else {
            start.setDate(end.getDate() - days + 1);
            start.setHours(0, 0, 0, 0);
        }
        
        setStartDate(start);
        setEndDate(end);
        onDateRangeChange({ startDate: start, endDate: end });
        setIsOpen(false);
    };

    const isDateInRange = (date) => {
        if (!startDate) return false;
        if (!endDate && hoveredDate) {
            const rangeStart = startDate < hoveredDate ? startDate : hoveredDate;
            const rangeEnd = startDate < hoveredDate ? hoveredDate : startDate;
            return date >= rangeStart && date <= rangeEnd;
        }
        if (!endDate) return false;
        return date >= startDate && date <= endDate;
    };

    const isDateSelected = (date) => {
        return (startDate && date.toDateString() === startDate.toDateString()) ||
               (endDate && date.toDateString() === endDate.toDateString());
    };

    const formatDateRange = () => {
        if (!startDate || !endDate) return 'Select Date Range';
        
        const formatDate = (date) => {
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const year = date.getFullYear();
            return `${month}/${day}/${year}`;
        };
        
        return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    };

    const renderCalendar = () => {
        const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
        const days = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        // Render day names
        const dayHeaders = dayNames.map(day => (
            <div key={day} className="drp-day-name">
                {day}
            </div>
        ));

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(<div key={`empty-${i}`} className="drp-day drp-day-empty"></div>);
        }

        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            date.setHours(0, 0, 0, 0);
            
            const isSelected = isDateSelected(date);
            const isInRange = isDateInRange(date);
            const isToday = date.toDateString() === new Date().toDateString();

            days.push(
                <div
                    key={day}
                    className={`drp-day ${isSelected ? 'drp-day-selected' : ''} ${isInRange ? 'drp-day-in-range' : ''} ${isToday ? 'drp-day-today' : ''}`}
                    onClick={() => handleDateClick(date)}
                    onMouseEnter={() => setHoveredDate(date)}
                    onMouseLeave={() => setHoveredDate(null)}
                >
                    {day}
                </div>
            );
        }

        return (
            <>
                <div className="drp-calendar-header">
                    {dayHeaders}
                </div>
                <div className="drp-calendar-grid">
                    {days}
                </div>
            </>
        );
    };

    const previousMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
    };

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    return (
        <div className="date-range-picker" ref={dropdownRef}>
            <Button 
                variant="outline" 
                onClick={() => setIsOpen(!isOpen)}
                className={startDate && endDate ? 'drp-button-active' : ''}
            >
                <Calendar className="mr-2 h-4 w-4" />
                {formatDateRange()}
            </Button>

            {isOpen && (
                <div className="drp-dropdown">
                    <div className="drp-content">
                        {/* Quick Filters */}
                        <div className="drp-quick-filters">
                            <h4 className="drp-section-title">Quick Filters</h4>
                            <div className="drp-filter-buttons">
                                <button onClick={() => handleQuickFilter(1, 'today')} className="drp-filter-btn">
                                    Today
                                </button>
                                <button onClick={() => handleQuickFilter(7)} className="drp-filter-btn">
                                    Last 7 Days
                                </button>
                                <button onClick={() => handleQuickFilter(30)} className="drp-filter-btn">
                                    Last 30 Days
                                </button>
                                <button onClick={() => handleQuickFilter(null, 'thisMonth')} className="drp-filter-btn">
                                    This Month
                                </button>
                                <button onClick={() => handleQuickFilter(null, 'lastMonth')} className="drp-filter-btn">
                                    Last Month
                                </button>
                            </div>
                        </div>

                        {/* Calendar */}
                        <div className="drp-calendar">
                            <div className="drp-month-header">
                                <button onClick={previousMonth} className="drp-nav-btn">
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="drp-month-label">
                                    {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                                </span>
                                <button onClick={nextMonth} className="drp-nav-btn">
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                            {renderCalendar()}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="drp-actions">
                        <Button variant="ghost" size="sm" onClick={handleClear}>
                            <X className="mr-1 h-3 w-3" />
                            Clear
                        </Button>
                        <Button 
                            size="sm" 
                            onClick={handleApply}
                            disabled={!startDate || !endDate}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Apply
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateRangePicker;
