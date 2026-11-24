/** Email yang boleh terlipat sesudah "@" (bukan di tengah "gmail.com") saat ruangnya sempit */
export default function TeksEmail({ alamat }: { alamat: string }) {
  const at = alamat.indexOf('@')
  return at < 0 ? <>{alamat}</> : <>{alamat.slice(0, at + 1)}<wbr />{alamat.slice(at + 1)}</>
}
