import Image from 'next/image';

export default function Brand() {
  return <a className="public-brand" href="/" aria-label="Turnli home"><Image src="/icons/turnli.svg" alt="" width={40} height={40} unoptimized /><span>turnli</span></a>;
}
