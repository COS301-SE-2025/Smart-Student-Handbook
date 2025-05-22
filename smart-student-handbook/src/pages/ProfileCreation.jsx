import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link } from 'react-router-dom';

// Define form schema with Zod
const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  surname: z.string().min(2, { message: 'Surname must be at least 2 characters' }),
  studentNumber: z.string().regex(/^[A-Za-z0-9]+$/, { message: 'Student number must be alphanumeric' }),
  program: z.string().min(3, { message: 'Program of study must be at least 3 characters' }),
  bio: z.string().max(200, { message: 'Bio must be 200 characters or less' }).optional(),
});

function ProfileCreation() {
  const [profile, setProfile] = useState(null);
  const [profilePic, setProfilePic] = useState(null);
  const [studyTimeFilter, setStudyTimeFilter] = useState('weekly');
  const [isLoggedIn] = useState(true); // Mock login state; replace with actual auth logic

  // Mock data for demo purposes (this will come from Firebase later)
  const mockData = {
    totalStudyTime: 120, // Total hours
    longestStreak: 5, // Days
    dailyStudyHours: [
      { date: '2025-05-20', hours: 3 },
      { date: '2025-05-19', hours: 2 },
      { date: '2025-05-18', hours: 4 },
      { date: '2025-04-15', hours: 1 },
      { date: '2024-12-01', hours: 2 },
    ],
    numberOfNotes: 15,
    notebooks: ['Math 101', 'Physics 202', 'CS 301'],
    notifications: [
      'Alice liked your note on Calculus.',
      'Bob shared your Physics 202 summary.',
    ],
  };

  // Load profile from localStorage on component mount
  useEffect(() => {
    const savedProfile = localStorage.getItem('userProfile');
    const savedProfilePic = localStorage.getItem('profilePic');
    if (savedProfile) {
      setProfile(JSON.parse(savedProfile));
    }
    if (savedProfilePic) {
      setProfilePic(savedProfilePic);
    }
  }, []);

  // Initialize form with react-hook-form and Zod
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      surname: '',
      studentNumber: '',
      program: '',
      bio: '',
    },
  });

  // Handle profile picture upload
  const handleProfilePicChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        setProfilePic(base64String);
        localStorage.setItem('profilePic', base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle form submission
  const onSubmit = (data) => {
    const profileData = {
      ...data,
      ...mockData, // Merge with mock data for demo
      createdAt: new Date().toISOString(),
    };
    setProfile(profileData);
    localStorage.setItem('userProfile', JSON.stringify(profileData));
    console.log('Profile created:', profileData);
  };

  // Filter daily study hours based on selected time range
  const filterStudyHours = () => {
    const now = new Date();
    return mockData.dailyStudyHours.filter((entry) => {
      const entryDate = new Date(entry.date);
      if (studyTimeFilter === 'weekly') {
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(now.getDate() - 7);
        return entryDate >= oneWeekAgo && entryDate <= now;
      } else if (studyTimeFilter === 'monthly') {
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(now.getMonth() - 1);
        return entryDate >= oneMonthAgo && entryDate <= now;
      } else if (studyTimeFilter === 'yearly') {
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(now.getFullYear() - 1);
        return entryDate >= oneYearAgo && entryDate <= now;
      }
      return true;
    });
  };

  const filteredStudyHours = filterStudyHours();
  const totalFilteredHours = filteredStudyHours.reduce((sum, entry) => sum + entry.hours, 0);

  if (!isLoggedIn) {
    return <p className="text-center mt-10">Please log in to create a profile.</p>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {!profile ? (
        // Profile Creation Form
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Create Your Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your first name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="surname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Surname</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your surname" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="studentNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Student Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your student number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="program"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Program of Study</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Computer Science" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Tell us about yourself" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormItem>
                  <FormLabel>Profile Picture</FormLabel>
                  <FormControl>
                    <Input type="file" accept="image/*" onChange={handleProfilePicChange} />
                  </FormControl>
                </FormItem>
                <Button type="submit" className="w-full">
                  Save Profile
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : (
        // Profile Display
        <div className="space-y-6">
          {/* Profile Header */}
          <Card>
            <CardContent className="flex items-center space-x-4 pt-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profilePic} alt="Profile Picture" />
                <AvatarFallback>{profile.name[0] + profile.surname[0]}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-2xl font-bold">{profile.name} {profile.surname}</h2>
                <p className="text-gray-600">{profile.studentNumber}</p>
                <p className="text-gray-600">{profile.program}</p>
                <p className="text-gray-600">{profile.bio || 'No bio provided'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Study Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Study Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold">Total Study Time</p>
                  <p>{profile.totalStudyTime} hours</p>
                </div>
                <div>
                  <p className="font-semibold">Longest Study Streak</p>
                  <p>{profile.longestStreak} days</p>
                </div>
              </div>
              <div>
                <p className="font-semibold mb-2">Daily Study Hours</p>
                <Select onValueChange={setStudyTimeFilter} defaultValue={studyTimeFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
                <div className="mt-4">
                  <p>Total: {totalFilteredHours} hours</p>
                  <ul className="mt-2 space-y-1">
                    {filteredStudyHours.map((entry, index) => (
                      <li key={index} className="text-sm">
                        {entry.date}: {entry.hours} hours
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notebooks */}
          <Card>
            <CardHeader>
              <CardTitle>Notebooks</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {profile.notebooks.map((notebook, index) => (
                  <li key={index} className="p-2 bg-gray-50 rounded-md">
                    {notebook}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Your Notes ({profile.numberOfNotes})</CardTitle>
            </CardHeader>
            <CardContent>
              <Link to="/notes" className="block p-4 bg-gray-50 rounded-md hover:bg-gray-100">
                <p className="font-semibold">View Your Notes</p>
                <p className="text-sm text-gray-600">Access all your notes here.</p>
              </Link>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {profile.notifications.map((notification, index) => (
                  <li key={index} className="p-2 bg-gray-50 rounded-md">
                    {notification}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default ProfileCreation;