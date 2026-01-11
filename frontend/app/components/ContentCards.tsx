export default function ContentCards() {
  const cards = [
    {
      title: "Research and Innovation",
      color: "bg-red-400",
      icon: "🔍"
    },
    {
      title: "2025 Legislative Priorities",
      color: "bg-blue-900",
      icon: "📋"
    },
    {
      title: "Become an Affiliate Member",
      color: "bg-yellow-100",
      textColor: "text-yellow-600",
      icon: "🤝"
    },
    {
      title: "Resources",
      color: "bg-gray-200",
      icon: "📚"
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, index) => (
          <div
            key={index}
            className={`${card.color} ${card.textColor || 'text-white'} rounded-lg p-8 h-64 flex flex-col items-center justify-center text-center cursor-pointer hover:opacity-90 transition-opacity shadow-lg`}
          >
            <div className="text-5xl mb-4">{card.icon}</div>
            <h3 className="text-xl font-bold">{card.title}</h3>
          </div>
        ))}
      </div>
    </div>
  );
}
