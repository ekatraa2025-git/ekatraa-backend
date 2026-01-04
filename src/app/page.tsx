import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <main className="flex flex-col items-center justify-center gap-8 px-6 py-12 text-center">
        <div className="flex items-center gap-3 mb-4">
          <Image
            src="/logo.png"
            alt="Ekatraa Logo"
            width={60}
            height={60}
            priority
            className="rounded-lg"
          />
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
            EKATRAA
          </h1>
        </div>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-md">
          Event Management Platform
        </p>
        <Link
          href="/login"
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-blue-600 px-8 py-3 text-base font-semibold text-white shadow-md hover:bg-blue-700 hover:shadow-lg transition-all duration-200"
        >
          Admin Login
        </Link>
      </main>
    </div>
  );
}
