// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { createContext, useContext } from 'react';
/** Public views only need a signed-in hint. They do not import session/API services. */
export const PublicSessionContext = createContext(false);
export function usePublicSession() { return useContext(PublicSessionContext); }
