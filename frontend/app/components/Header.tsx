import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-white shadow-sm">
      {/* Top bar */}
      <div className="bg-[#1e5a8e] text-white">
        <div className="max-w-7xl mx-auto px-4 py-2 flex justify-end items-center gap-4 text-sm">
          <button className="px-3 py-1 hover:bg-[#164a75] rounded">MEMBERSHIP</button>
          <button className="px-3 py-1 bg-[#c94a3c] hover:bg-[#b43a2c] rounded">LOGIN</button>
          <div className="flex gap-2">
            <a href="#" className="w-8 h-8 bg-[#0077b5] rounded flex items-center justify-center hover:opacity-80">in</a>
            <a href="#" className="w-8 h-8 bg-[#1877f2] rounded flex items-center justify-center hover:opacity-80">f</a>
            <a href="#" className="w-8 h-8 bg-[#e4405f] rounded flex items-center justify-center hover:opacity-80">ig</a>
            <a href="#" className="w-8 h-8 bg-[#000000] rounded flex items-center justify-center hover:opacity-80">X</a>
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-[#1e5a8e] font-bold text-2xl">NASWA</div>
            <div className="text-sm text-gray-600">
              <div className="font-semibold">National Association of State Workforce</div>
              <div>Agencies</div>
            </div>
          </div>
          
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium">
            <Link href="#" className="text-gray-700 hover:text-[#1e5a8e]">ABOUT</Link>
            <Link href="#" className="text-gray-700 hover:text-[#1e5a8e]">POLICY & ADVOCACY</Link>
            <Link href="#" className="text-gray-700 hover:text-[#1e5a8e]">PROGRAMS</Link>
            <Link href="#" className="text-gray-700 hover:text-[#1e5a8e]">PARTNER WITH US</Link>
            <Link href="#" className="text-gray-700 hover:text-[#1e5a8e]">MEETINGS</Link>
            <Link href="#" className="text-gray-700 hover:text-[#1e5a8e]">RESOURCES</Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
