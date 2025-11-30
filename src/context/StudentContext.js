'use client';

import { createContext, useContext, useState } from 'react';

// Create the context object
const StudentContext = createContext();

// Create a "Provider" component that will wrap our student layout
export function StudentProvider({ children }) {
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

    // The value that will be shared with all child components
    const value = { isLinkModalOpen, setIsLinkModalOpen };

    return (
        <StudentContext.Provider value={value}>
            {children}
        </StudentContext.Provider>
    );
}

// Create a custom hook for easy access to the context
export function useStudentContext() {
    return useContext(StudentContext);
}