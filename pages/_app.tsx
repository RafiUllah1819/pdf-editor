import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Layout from "@/components/layout/Layout";

type PageProps = {
  hideNav?: boolean;
};

export default function App({ Component, pageProps }: AppProps) {
  const { hideNav } = pageProps as PageProps;
  return (
    <Layout hideNav={hideNav}>
      <Component {...pageProps} />
    </Layout>
  );
}
