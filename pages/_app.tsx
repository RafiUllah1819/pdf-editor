import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Layout from "@/components/layout/Layout";
import type { SessionUser } from "@/lib/session";

// Pages that want to show user info in the Navbar include `user` in their
// getServerSideProps return value. Pages without SSR (like the landing page)
// simply won't have it and the Navbar will show the Sign in link instead.
type PageProps = {
  hideNav?: boolean;
  user?: SessionUser;
};

export default function App({ Component, pageProps }: AppProps) {
  const { hideNav, user } = pageProps as PageProps;
  return (
    <Layout hideNav={hideNav} user={user}>
      <Component {...pageProps} />
    </Layout>
  );
}
