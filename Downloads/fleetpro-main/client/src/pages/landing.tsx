import { Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Car, 
  Users, 
  BarChart3, 
  FileText, 
  Shield, 
  UserCheck,
  Phone,
  Mail,
  Check,
  ArrowRight,
  Calendar,
  TrendingUp,
  Menu,
  X,
  MessageCircle
} from "lucide-react";
// Logo removed during cleanup

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [showBanner, setShowBanner] = useState(() => {
    // Check localStorage to see if banner was previously dismissed
    const dismissed = localStorage.getItem('fleetpro-banner-dismissed');
    return !dismissed;
  });

  const handleDismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem('fleetpro-banner-dismissed', 'true');
  };

  const handleGetStarted = (planName: string) => {
    setSelectedPlan(planName);
    setShowContactModal(true);
  };

  const handleCall = () => {
    window.open('tel:+917777888220', '_self');
  };

  const handleWhatsApp = () => {
    const message = `Hi! I'm interested in the ${selectedPlan} plan for FleetPro. Can you please provide more details about pricing and features?`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/917777888220?text=${encodedMessage}`, '_blank');
  };

  const handleEmail = () => {
    const subject = `Inquiry about ${selectedPlan} Plan - FleetPro`;
    const body = `Hi,\n\nI'm interested in learning more about the ${selectedPlan} plan for FleetPro. Please provide me with detailed information about:\n\n- Pricing and payment options\n- Features included\n- Setup process\n- Support availability\n\nThank you!`;
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);
    window.open(`mailto:support@raydify.in?subject=${encodedSubject}&body=${encodedBody}`, '_self');
  };
  const features = [
    {
      icon: Calendar,
      title: "Daily Booking Management",
      description: "Streamline your booking process with an intuitive interface that handles everything from customer details to vehicle assignments."
    },
    {
      icon: Car,
      title: "Vehicle & Driver Tracking",
      description: "Keep track of your entire fleet and driver roster with real-time availability status and comprehensive management tools."
    },
    {
      icon: TrendingUp,
      title: "Real-Time Analytics",
      description: "Get instant insights into your business performance with detailed revenue reports and fleet utilization metrics."
    },
    {
      icon: FileText,
      title: "PDF Invoice Generator",
      description: "Generate professional invoices instantly with customizable templates and automatic calculations for all booking types."
    },
    {
      icon: Shield,
      title: "Role-Based Access",
      description: "Secure your business with granular permission controls for different user roles including admin, client, and manager access."
    },
    {
      icon: UserCheck,
      title: "Manager User Control",
      description: "Create and manage sub-users with specific permissions, enabling team collaboration while maintaining data security."
    }
  ];

  const pricingPlans = [
    {
      name: "Starter",
      price: "₹499",
      period: "/month",
      description: "Perfect for small fleet operators",
      features: [
        "Up to 5 vehicles",
        "1 manager user",
        "Up to 5 drivers",
        "Basic booking management",
        "Standard reporting",
        "Email support"
      ],
      popular: false
    },
    {
      name: "Pro",
      price: "₹799",
      period: "/month",
      description: "Ideal for growing businesses",
      features: [
        "Up to 40 vehicles",
        "20 manager users",
        "Up to 60 drivers",
        "Advanced analytics",
        "Custom invoice templates",
        "Priority support",
        "WhatsApp integration"
      ],
      popular: true
    },
    {
      name: "Custom",
      price: "Contact Us",
      period: "",
      description: "Tailored for enterprise needs",
      features: [
        "Unlimited vehicles",
        "Unlimited manager users",
        "Custom integrations",
        "Dedicated support",
        "Advanced security",
        "Custom branding"
      ],
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Notification Banner */}
      {showBanner && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 relative z-50">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm sm:text-base">
              <span className="text-lg">🎉</span>
              <span className="font-medium">
                Try FleetPro free for 30 days — no credit card or account details required!
              </span>
            </div>
            <button
              onClick={handleDismissBanner}
              className="ml-4 p-1 rounded-full hover:bg-white/10 transition-colors duration-200 flex-shrink-0"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Car className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">FleetPro</span>
            </div>
            
            <nav className="hidden md:flex items-center space-x-8">
              <a 
                href="#home" 
                className="text-gray-700 hover:text-blue-600 transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('home')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Home
              </a>
              <a 
                href="#features" 
                className="text-gray-700 hover:text-blue-600 transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Features
              </a>
              <a 
                href="#pricing" 
                className="text-gray-700 hover:text-blue-600 transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Pricing
              </a>
              <a 
                href="#contact" 
                className="text-gray-700 hover:text-blue-600 transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Contact
              </a>
              <Link href="/login">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Access Dashboard
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </nav>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center space-x-2">
              <Link href="/login">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                  Dashboard
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
          
          {/* Mobile Navigation Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden bg-white border-t border-gray-200">
              <div className="px-4 py-4 space-y-3">
                <a 
                  href="#home" 
                  className="block text-gray-700 hover:text-blue-600 transition-colors py-2"
                  onClick={(e) => {
                    e.preventDefault();
                    setMobileMenuOpen(false);
                    document.getElementById('home')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Home
                </a>
                <a 
                  href="#features" 
                  className="block text-gray-700 hover:text-blue-600 transition-colors py-2"
                  onClick={(e) => {
                    e.preventDefault();
                    setMobileMenuOpen(false);
                    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Features
                </a>
                <a 
                  href="#pricing" 
                  className="block text-gray-700 hover:text-blue-600 transition-colors py-2"
                  onClick={(e) => {
                    e.preventDefault();
                    setMobileMenuOpen(false);
                    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Pricing
                </a>
                <a 
                  href="#contact" 
                  className="block text-gray-700 hover:text-blue-600 transition-colors py-2"
                  onClick={(e) => {
                    e.preventDefault();
                    setMobileMenuOpen(false);
                    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Contact
                </a>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section id="home" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            FleetPro: Professional Fleet Management
            <span className="text-blue-600 block">Software for Taxi & Car Rental Business</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            India's leading fleet management platform for taxi and car rental businesses. 
            Manage vehicles, drivers, bookings, and revenue with our comprehensive SaaS solution. 
            Trusted by 500+ fleet operators across India.
          </p>
          <Link href="/login">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-4">
              Access Dashboard
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Complete Fleet Management Solution for Indian Businesses
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              FleetPro offers comprehensive fleet management software designed specifically for 
              taxi operators, car rental companies, and transport businesses across India. 
              From vehicle tracking to revenue analytics, manage everything in one platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <CardTitle className="text-xl font-semibold text-gray-900">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Choose Your Plan
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Flexible pricing options that grow with your business
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pricingPlans.map((plan, index) => (
              <Card key={index} className={`relative ${plan.popular ? 'border-blue-500 shadow-xl scale-105' : 'border-gray-200'}`}>
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-600">
                    Most Popular
                  </Badge>
                )}
                <CardHeader className="text-center pb-8">
                  <CardTitle className="text-2xl font-bold text-gray-900">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    {plan.period && <span className="text-gray-600">{plan.period}</span>}
                  </div>
                  <p className="text-gray-600 mt-2">{plan.description}</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center">
                        <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    onClick={() => handleGetStarted(plan.name)}
                    className={`w-full ${plan.popular ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-800 hover:bg-gray-900'}`}
                  >
                    Get free trial
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Get in Touch
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Have questions? We're here to help you get started
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Mail className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-semibold">Email Support</CardTitle>
                    <p className="text-gray-600">Get help via email</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <a 
                  href="mailto:support@fleetpro.com" 
                  className="text-blue-600 hover:text-blue-700 font-medium text-lg"
                >
                  support@fleetpro.com
                </a>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Phone className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-semibold">WhatsApp Support</CardTitle>
                    <p className="text-gray-600">Quick chat support</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <a 
                  href="https://wa.me/917777888220" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-green-600 hover:text-green-700 font-medium text-lg"
                >
                  +91 7777 888 220
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-6 md:space-y-0">
            {/* Left - FleetPro Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Car className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">FleetPro</span>
            </div>
            
            {/* Middle - Copyright */}
            <div className="text-center">
              <p className="text-gray-400">© 2025 FleetPro. All rights reserved.</p>
            </div>

            {/* Right - Powered by Raydify */}
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">Powered by</span>
              <a 
                href="https://raydify.in" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
              >
                <span className="text-gray-400 font-medium hover:text-white transition-colors">Raydify</span>
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Contact Options Modal */}
      <Dialog open={showContactModal} onOpenChange={setShowContactModal}>
        <DialogContent className="sm:max-w-lg max-w-[95vw] rounded-2xl border-0 shadow-2xl bg-gradient-to-br from-white to-gray-50/50 backdrop-blur-lg">
          {/* Close Button */}
          <button
            onClick={() => setShowContactModal(false)}
            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-gray-600" />
          </button>

          <DialogHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
              <MessageCircle className="h-8 w-8 text-white" />
            </div>
            <DialogTitle className="text-2xl font-bold text-gray-900 mb-2">
              Get Started with {selectedPlan} Plan
            </DialogTitle>
            <p className="text-gray-600 text-base max-w-sm mx-auto leading-relaxed">
              Choose your preferred way to connect with our team for plan purchasing and guidance
            </p>
          </DialogHeader>
          
          <div className="py-4">
            <div className="space-y-3">
              {/* Call Option */}
              <Button
                onClick={handleCall}
                className="group w-full h-16 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border-0"
                size="lg"
              >
                <div className="flex items-center space-x-4 w-full">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                    <Phone className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-lg">Call Us</div>
                    <div className="text-sm text-blue-100 opacity-90">+91 7777 888 220</div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-white/70 group-hover:text-white group-hover:translate-x-1 transition-all duration-200" />
                </div>
              </Button>

              {/* WhatsApp Option */}
              <Button
                onClick={handleWhatsApp}
                className="group w-full h-16 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border-0"
                size="lg"
              >
                <div className="flex items-center space-x-4 w-full">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                    <MessageCircle className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-lg">WhatsApp</div>
                    <div className="text-sm text-green-100 opacity-90">Quick chat support</div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-white/70 group-hover:text-white group-hover:translate-x-1 transition-all duration-200" />
                </div>
              </Button>

              {/* Email Option */}
              <Button
                onClick={handleEmail}
                className="group w-full h-16 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border-0"
                size="lg"
              >
                <div className="flex items-center space-x-4 w-full">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                    <Mail className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-lg">Email Us</div>
                    <div className="text-sm text-slate-200 opacity-90">support@raydify.in</div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-white/70 group-hover:text-white group-hover:translate-x-1 transition-all duration-200" />
                </div>
              </Button>
            </div>

            {/* Bottom Message */}
            <div className="mt-6 text-center bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-gray-800">Our team is online</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Available to help you choose the right plan and get started quickly!
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}