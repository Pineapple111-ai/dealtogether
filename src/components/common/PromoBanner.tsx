import Image from "next/image";
import Link from "next/link";

export default function PromoBanner({
  image,
  title,
  desc,
  href,
  cta,
  children,
}: {
  image: string;
  title: string;
  desc?: string;
  href?: string;
  cta?: string;
  children?: React.ReactNode;
}) {
  const body = (
    <div className="relative overflow-hidden rounded-xl bg-navy">
      <Image src={image} alt="" fill sizes="(max-width: 1440px) 100vw, 1440px" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-navy/95 via-navy/75 to-navy/20 md:via-navy/55 md:to-transparent" />
      <div className="relative flex min-h-60 max-w-xl flex-col justify-center p-6 text-white md:min-h-72 md:p-10">
        <h2 className="text-2xl font-extrabold leading-tight tracking-tight md:text-[32px]">{title}</h2>
        {desc && <p className="mt-2 text-sm text-white/75 md:text-base">{desc}</p>}
        {children}
        {cta && (
          <span className="mt-6 inline-flex w-fit rounded-lg bg-white px-5 py-3 text-sm font-bold text-navy">{cta}</span>
        )}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}