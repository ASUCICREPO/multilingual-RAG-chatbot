export default function Hero() {
  return (
    <div className="relative">
      {/* Main hero section */}
      <div className="relative h-[400px] bg-gradient-to-r from-teal-500 to-teal-600 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] bg-repeat"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 h-full flex items-center">
          <div className="text-white">
            <h1 className="text-7xl font-bold mb-4 tracking-tight">winter</h1>
            <h2 className="text-4xl font-light mb-8">POLICY FORUM</h2>
            <div className="text-xl mb-6">
              <p className="font-semibold">National Harbor, MD</p>
              <p>February 25, 2026</p>
            </div>
            <h3 className="text-3xl font-bold">Register Now! 2026 Winter Policy Forum</h3>
          </div>
        </div>
      </div>

      {/* Side panels */}
      <div className="absolute right-0 top-0 w-64 space-y-2">
        <div className="bg-gray-800 text-white p-4 h-32 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm mb-2">Registration Open! 2026</p>
            <p className="font-bold">Administration &</p>
            <p className="font-bold">Finance Training</p>
            <p className="text-xs mt-2">Denver, CO | March 17-19, 2026</p>
          </div>
        </div>
        
        <div className="bg-gray-700 text-white p-4 h-32 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm mb-2">Registration Open! 2026</p>
            <p className="font-bold">SIDES Seminar</p>
          </div>
        </div>
        
        <div className="bg-orange-600 text-white p-4 h-32 flex items-center justify-center">
          <div className="text-center">
            <p className="font-bold text-lg">FEATURED</p>
            <p className="font-bold text-lg">INTEGRITY</p>
          </div>
        </div>
      </div>
    </div>
  );
}
