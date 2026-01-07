import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface ProjectContextType {
  selectedProjectId: string | null;
  setSelectedProjectId: (projectId: string | null) => void;
  selectedProject: { projectId: string; projectName: string } | null;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Auto-select first project when user logs in
  useEffect(() => {
    if (isAuthenticated && user?.projectAccess && user.projectAccess.length > 0) {
      if (!selectedProjectId) {
        setSelectedProjectId(user.projectAccess[0].projectId);
      }
    } else {
      setSelectedProjectId(null);
    }
  }, [isAuthenticated, user?.projectAccess, selectedProjectId]);

  const selectedProject = user?.projectAccess?.find(
    p => p.projectId === selectedProjectId
  ) || null;

  return (
    <ProjectContext.Provider
      value={{
        selectedProjectId,
        setSelectedProjectId,
        selectedProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}

