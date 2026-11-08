"use client";

import Header from "@/components/dashboard/Header";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import { useState } from "react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate form submission
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      
      <main className="flex-1 py-12 px-6">
        <div className="max-w-4xl mx-auto">
          
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-5xl font-extrabold text-theme-primary mb-4">
              Get in Touch
            </h1>
            <p className="text-lg text-theme-secondary">
              Have questions about a parcel or need support? We're here to help.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Contact Info */}
            <div className="md:col-span-1 space-y-6">
              <div className="bg-theme-card p-6 rounded-xl border border-theme shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-theme-primary">Email</h3>
                    <p className="text-sm text-theme-secondary">support@landoracle.ai</p>
                  </div>
                </div>
              </div>

              <div className="bg-theme-card p-6 rounded-xl border border-theme shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                   <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-theme-primary">Phone</h3>
                    <p className="text-sm text-theme-secondary">(904) 210-7697</p>
                  </div>
                </div>
              </div>

               <div className="bg-theme-card p-6 rounded-xl border border-theme shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-600 dark:text-purple-400">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-theme-primary">Office</h3>
                    <p className="text-sm text-theme-secondary">Jacksonville, FL</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="md:col-span-2">
              <div className="bg-theme-card p-8 rounded-xl border border-theme shadow-lg">
                <h2 className="text-2xl font-bold text-theme-primary mb-6">Send us a message</h2>
                
                {submitted ? (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-8 rounded-lg text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-800 rounded-full mb-4">
                      <Send className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-xl font-bold text-green-800 dark:text-green-300 mb-2">Message Sent!</h3>
                    <p className="text-green-700 dark:text-green-400">Thanks for reaching out. We'll get back to you shortly.</p>
                    <button 
                      onClick={() => setSubmitted(false)}
                      className="mt-6 px-4 py-2 text-sm font-medium text-green-700 hover:text-green-800 dark:text-green-400 hover:underline"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label htmlFor="firstName" className="text-sm font-medium text-theme-secondary">First Name</label>
                        <input 
                          type="text" 
                          id="firstName" 
                          required
                          className="w-full px-4 py-2 rounded-lg border border-theme bg-theme-input text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          placeholder="John"
                        />
                      </div>
                      <div className="space-y-2">
                         <label htmlFor="lastName" className="text-sm font-medium text-theme-secondary">Last Name</label>
                        <input 
                          type="text" 
                          id="lastName" 
                          required
                          className="w-full px-4 py-2 rounded-lg border border-theme bg-theme-input text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          placeholder="Doe"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm font-medium text-theme-secondary">Email Address</label>
                       <input 
                          type="email" 
                          id="email" 
                          required
                          className="w-full px-4 py-2 rounded-lg border border-theme bg-theme-input text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          placeholder="john@example.com"
                        />
                    </div>

                     <div className="space-y-2">
                      <label htmlFor="message" className="text-sm font-medium text-theme-secondary">Message</label>
                      <textarea 
                        id="message" 
                        rows={4}
                        required
                        className="w-full px-4 py-2 rounded-lg border border-theme bg-theme-input text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                        placeholder="How can we help you?"
                      />
                    </div>

                    <button 
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                    >
                      Send Message
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
