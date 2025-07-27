import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styled from 'styled-components';

const LayoutContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
`;

const Header = styled.header`
  background-color: #fff;
  border-bottom: 1px solid #e0e0e0;
  padding: 0 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const Nav = styled.nav`
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 60px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
`;

const Logo = styled(Link)`
  font-size: 20px;
  font-weight: bold;
  color: #007bff;
  text-decoration: none;
  
  &:hover {
    color: #0056b3;
  }
`;

const NavLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
`;

const NavLink = styled(Link)`
  color: #333;
  text-decoration: none;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 4px;
  transition: background-color 0.2s;

  &:hover {
    background-color: #f8f9fa;
  }
`;

const UserMenu = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const UserName = styled.span`
  color: #333;
  font-weight: 500;
`;

const LogoutButton = styled.button`
  background: none;
  border: none;
  color: #dc3545;
  cursor: pointer;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 4px;
  transition: background-color 0.2s;

  &:hover {
    background-color: #f8f9fa;
  }
`;

const Main = styled.main`
  flex: 1;
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
`;

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <LayoutContainer>
      <Header>
        <Nav>
          <Logo to="/dashboard">AI Info Aggregator</Logo>
          
          <NavLinks>
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/sources">Sources</NavLink>
            <NavLink to="/library">Library</NavLink>
            <NavLink to="/collections">Collections</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </NavLinks>

          <UserMenu>
            <UserName>Hello, {user?.name}</UserName>
            <NavLink to="/profile">Profile</NavLink>
            <LogoutButton onClick={handleLogout}>
              Logout
            </LogoutButton>
          </UserMenu>
        </Nav>
      </Header>

      <Main>
        {children}
      </Main>
    </LayoutContainer>
  );
};

export default Layout;