import type { AppProps } from 'next/app';
import { AuthUserProvider } from '@/src/context/AuthUserProvider';
import Header from '@/src/components/Header';
import '@/src/styles/globals.css';

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AuthUserProvider>
      <div className="site-shell">
        <Header />
        <Component {...pageProps} />
      </div>
    </AuthUserProvider>
  );
}
