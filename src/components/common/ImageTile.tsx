import Image from "next/image";
import Link from "next/link";

export default function ImageTile({
  href,
  image,
  title,
  sub,
  meta,
}: {
  href: string;
  image: string | null;
  title: string;
  sub?: string;
  meta?: string;
}) {
  return (
    <Link href={href} className="group relative block aspect-square overflow-hidden rounded-xl bg-soft">
      {image && (
        <Image src={image} alt="" fill sizes="(max-width: 768px) 50vw, 20vw" className="object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4 text-white md:p-5">
        <p className="text-lg font-bold group-hover:underline group-hover:underline-offset-4">{title}</p>
        {sub && <p className="mt-0.5 text-xs text-white/75">{sub}</p>}
        {meta && <p className="tabular mt-2 text-[13px] text-white/85">{meta}</p>}
      </div>
    </Link>
  );
}