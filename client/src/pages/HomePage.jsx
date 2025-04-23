import { useNavigate }  from 'react-router-dom';

export default function HomePage() {
    const navigate = useNavigate();
    
    return (
        <div>
            <h1>HomePage</h1>
            <p>view booking and manage bookings</p>
            <button onClick={() => navigate("/admin")}> Go to Admin Panel</button>
            
        </div>
    )
}