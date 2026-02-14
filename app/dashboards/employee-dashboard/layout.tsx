import React from "react";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div>
      <main className="max-h-screen flex-grow overflow-y-auto p-4 lg:p-8">
        {/* Main content */}
        {children}
      </main>
    </div>
  );
};

export default Layout;
