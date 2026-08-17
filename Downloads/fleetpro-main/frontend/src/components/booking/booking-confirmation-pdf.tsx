import React from 'react';
import { Calendar, MapPin, Car, User } from 'lucide-react';

interface BookingConfirmationPDFProps {
  booking: {
    customerName: string;
    pickupLocation: string;
    dropoffLocation: string;
    pickupDate: string;
    pickupTime: string;
    returnDate: string;
    returnTime: string;
    vehicleName: string;
    bookingType: string;
    bookingId: string;
    companyLogo?: string;
    useThirdPartyDriver?: boolean;
    thirdPartyDriverName?: string;
    thirdPartyDriverCharges?: number;
  };
}

const BookingConfirmationPDF: React.FC<BookingConfirmationPDFProps> = ({ booking }) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (timeStr: string) => {
    return timeStr;
  };

  const getServiceType = (bookingType: string) => {
    return bookingType === 'self_drive' ? 'Self Drive' : 'With Driver';
  };

  const getRouteDisplay = () => {
    if (booking.dropoffLocation === 'Local') {
      return `${booking.pickupLocation} → Local`;
    } else if (booking.dropoffLocation === 'Not Decided Yet') {
      return `${booking.pickupLocation} → Not Decided`;
    } else {
      return `${booking.pickupLocation} → ${booking.dropoffLocation}`;
    }
  };

  return (
    <div id="booking-confirmation-pdf" className="max-w-2xl mx-auto p-4 bg-white">
      {/* Header with Company Logo and Success Message */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-20 h-20 mb-3">
          {booking.companyLogo ? (
            <img 
              src={booking.companyLogo} 
              alt="Company Logo" 
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h4M9 7h6m-6 4h6m-6 4h6m-6 4h6" />
              </svg>
            </div>
          )}
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Congratulations!</h1>
        <h2 className="text-xl font-semibold text-gray-700 mb-3">Your booking is confirmed.</h2>
      </div>

      {/* Booking ID Section - Prominent Display */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4 mb-5">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Booking ID</h3>
          <div className="text-2xl font-bold text-blue-600 tracking-wider mb-3">
            {booking.bookingId}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <div className="flex-shrink-0">
                <svg className="w-4 h-4 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-amber-800">Keep this Booking ID safe!</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  • Required for customer support & enquiries<br/>
                  • Needed for booking modifications<br/>
                  • Use for future discount eligibility
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trip Details Section */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
          <MapPin className="w-4 h-4 text-gray-600 mr-2" />
          Trip Details
        </h3>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Route:</span>
            <span className="text-sm font-semibold text-gray-900">{getRouteDisplay()}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Pickup:</span>
            <span className="text-sm font-semibold text-gray-900">
              {formatDate(booking.pickupDate)} at {formatTime(booking.pickupTime)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Return:</span>
            <span className="text-sm font-semibold text-gray-900">
              {formatDate(booking.returnDate)} at {formatTime(booking.returnTime)}
            </span>
          </div>
        </div>
      </div>

      {/* Vehicle & Service Section */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
          <Car className="w-4 h-4 text-gray-600 mr-2" />
          Vehicle & Service
        </h3>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Vehicle:</span>
            <span className="text-sm font-semibold text-gray-900">{booking.vehicleName}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Service Type:</span>
            <span className="text-sm font-semibold text-gray-900">{getServiceType(booking.bookingType)}</span>
          </div>
          

        </div>
      </div>

      {/* Customer Section */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
          <User className="w-4 h-4 text-gray-600 mr-2" />
          Customer
        </h3>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Name:</span>
          <span className="text-sm font-semibold text-gray-900">{booking.customerName}</span>
        </div>
      </div>

      {/* Footer with Contact Information */}
      <div className="text-center pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          For any queries or support, please contact us with your Booking ID
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Thank you for choosing our services!
        </p>
      </div>
    </div>
  );
};

export default BookingConfirmationPDF;