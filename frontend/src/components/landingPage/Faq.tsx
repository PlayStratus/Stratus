const faqs = [
  {
    question: "What are the system requirements?",
    answer:
      "A powerful computer is not needed to use Stratus since games are run remotely on Stratus' servers. Stratus works in Google Chrome on all major operating systems, although some users may need to disable graphics acceleration in the Chrome settings. However, Stratus does require a game controller, as keyboard & mouse input is not currently supported.",
  },
  {
    question:
      "How fast is Stratus?",
    answer:
      "Stratus is capable of streaming at 1080p at 60fps with an end-to-end latency of as little as 60ms, depending on local network latency and bandwidth. It also starts new streaming sessions in under 2 seconds.",
  },
  {
    question:
      "How does Stratus compare to Google Stadia, Nvidia GeForce NOW, Amazon Luna, etc?",
    answer:
      "Stratus offers comparable performance to commercial game streaming services such as Google Stadiua, Nvidia GeForce NOW, and Amazon Luna. Unlike these existing solutions however, Stratus supports streaming games directly from a web browser and is 100% free and open-source.",
  },
  {
    question: "What games are supported?",
    answer:
      "Stratus is capable of streaming most games that run natively on Windows or Linux with controller support. The Stratus library currently contains various popular open-source games including AssaultCube, SuperTux, and SuperTuxKart.",
  },
  {
    question: "What hardware do the servers run on?",
    answer:
      "The Stratus servers were designed for and tested on a cluster of 12 BC-250s that was originally created to mine cryptocurrency. Each BC-250 contains a PlayStation 5 APU with 6 CPU cores, an RX 6000-series GPU, and 16 GB of RAM, making them a great fit for game streaming.",
  },
  {
    question: "Is Stratus available to the public?",
    answer:
      "Stratus is currently only available to students at Oregon State University. We unfortunately have no plans to expand access due to hosting costs and complexities.",
  },
]

export default function Faq() {
  return (
    <div className='space-y-4'>
      {faqs.map((faq, index) => (
        <details
          key={index}
          className='group border border-border rounded-lg bg-card overflow-hidden [&_summary::-webkit-details-marker]:hidden shadow-sm'
        >
          <summary className='flex items-center justify-between px-6 py-4 cursor-pointer font-semibold text-lg hover:bg-muted/50 transition-colors'>
            {faq.question}
            <span className='transition duration-300 group-open:rotate-180 text-muted-foreground group-hover:text-foreground'>
              <svg
                fill='none'
                height='24'
                shapeRendering='geometricPrecision'
                stroke='currentColor'
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='1.5'
                viewBox='0 0 24 24'
                width='24'
              >
                <path d='M6 9l6 6 6-6'></path>
              </svg>
            </span>
          </summary>
          <div className='px-6 pb-5 pt-2 text-muted-foreground text-base leading-relaxed border-t border-border/50 bg-muted/10'>
            {faq.answer}
          </div>
        </details>
      ))}
    </div>
  )
}
