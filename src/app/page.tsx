import { getCurrentUser, getProjects } from '@/lib/data';
import { redirect } from 'next/navigation';
export default async function Home() { const { user } = await getCurrentUser(); if (!user) redirect('/login'); const { projects } = await getProjects(); if (!projects.length) redirect('/no-access'); const first:any = projects[0]; redirect(`/${first.projects?.[0]?.slug ?? first.slug}`); }
