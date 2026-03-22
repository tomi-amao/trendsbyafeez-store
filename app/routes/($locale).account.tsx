import {
  data as remixData,
  Form,
  NavLink,
  Outlet,
  useLoaderData,
} from 'react-router';
import type {Route} from './+types/account';
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';

export function shouldRevalidate() {
  return true;
}

export async function loader({context}: Route.LoaderArgs) {
  const {customerAccount} = context;
  const {data, errors} = await customerAccount.query(CUSTOMER_DETAILS_QUERY, {
    variables: {
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.customer) {
    throw new Error('Customer not found');
  }

  return remixData(
    {customer: data.customer},
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    },
  );
}

export default function AccountLayout() {
  const {customer} = useLoaderData<typeof loader>();

  const greeting = customer
    ? customer.firstName
      ? customer.firstName
      : 'My Account'
    : 'Account';

  return (
    <div className="account-layout">
      <aside className="account-sidebar">
        <div className="account-sidebar__header">
          <p className="account-sidebar__eyebrow">Welcome</p>
          <h1 className="account-sidebar__greeting">{greeting}</h1>
        </div>
        <AccountMenu />
      </aside>
      <main className="account-main">
        <Outlet context={{customer}} />
      </main>
    </div>
  );
}

function AccountMenu() {
  const linkClass = ({isActive}: {isActive: boolean; isPending: boolean}) =>
    `account-nav__link${isActive ? ' account-nav__link--active' : ''}`;

  return (
    <nav className="account-nav" aria-label="Account navigation">
      <NavLink to="/account/orders" className={linkClass}>
        Orders
      </NavLink>
      <NavLink to="/account/profile" className={linkClass}>
        Profile
      </NavLink>
      <NavLink to="/account/addresses" className={linkClass}>
        Addresses
      </NavLink>
      <Logout />
    </nav>
  );
}

function Logout() {
  return (
    <Form className="account-logout" method="POST" action="/account/logout">
      <button type="submit" className="account-nav__link account-nav__link--logout">
        Sign out
      </button>
    </Form>
  );
}
