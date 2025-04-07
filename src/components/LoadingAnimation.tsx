import React from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { Sword, Shield } from 'lucide-react';

export const LoadingAnimation: React.FC = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-blue-500/90 to-purple-600/90 backdrop-blur-sm z-50">
      <div className="bg-white/10 p-8 rounded-2xl backdrop-blur-md">
        <div className="w-48 h-48 relative">
          <DotLottieReact
            src="https://lottie.host/055580c8-e8cb-4a1d-9598-61a082345870/0SguHYrSmH.lottie"
            loop
            autoplay
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-bounce">
              <div className="relative">
                <Sword className="w-8 h-8 text-white absolute -left-4 -rotate-45" />
                <Shield className="w-8 h-8 text-white absolute -right-4 rotate-45" />
              </div>
            </div>
          </div>
        </div>
        <p className="text-white text-xl font-bold text-center mt-4 animate-pulse">
          Preparing Battle Arena...
        </p>
      </div>
    </div>
  );
};