import { createContext, useContext, useState } from 'react';
import api from '../api/api';

const AccountContext = createContext();

export const AccountProvider = ({ children }) => {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/accounts');
      setAccounts(data);
      if (selectedAccount) {
        const found = data.find(a => a.id === selectedAccount.id);
        setSelectedAccount(found || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const selectAccount = (account) => setSelectedAccount(account);

  return (
    <AccountContext.Provider value={{ accounts, selectedAccount, selectAccount, fetchAccounts, loading }}>
      {children}
    </AccountContext.Provider>
  );
};

export const useAccounts = () => useContext(AccountContext);
