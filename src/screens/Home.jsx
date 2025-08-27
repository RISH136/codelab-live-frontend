import React, { useContext, useState, useEffect } from 'react'
import { UserContext } from '../context/user.context'
import axios from "../config/axios"
import { useNavigate } from 'react-router-dom'

const Home = () => {

    const { user, logout } = useContext(UserContext)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [projectName, setProjectName] = useState(null)
    const [project, setProject] = useState([])

    const navigate = useNavigate()

    function createProject(e) {
        e.preventDefault()
        console.log({ projectName })

        axios.post('/projects/create', {
            name: projectName,
        })
            .then((res) => {
                console.log(res)
                setIsModalOpen(false)
            })
            .catch((error) => {
                console.log(error)
            })
    }

    useEffect(() => {
        axios.get('/projects/all').then((res) => {
            setProject(res.data.projects)

        }).catch(err => {
            console.log(err)
        })

    }, [])

    function isOwner(p) {
        // project.users[0] is owner as per backend logic
        return p?.users?.[0] === user?._id
    }

    async function deleteProject(projectId) {
        const confirmed = confirm('Are you sure you want to delete this project?')
        if (!confirmed) return

        try {
            await axios.delete(`/projects/delete/${projectId}`)
            setProject(prev => prev.filter(p => p._id !== projectId))
        } catch (err) {
            console.log(err)
            alert(err?.response?.data?.error || 'Failed to delete project')
        }
    }

    return (
        <main className='min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6'>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-white bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Welcome, {user?.email}
                </h1>
                <button
                    onClick={logout}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-lg transform hover:scale-105 border border-red-500/30"
                >
                    <i className="ri-logout-box-r-line"></i>
                    <span className="font-medium">Logout</span>
                </button>
            </div>
            
            <div className="projects flex flex-wrap gap-6">
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="project group p-6 border-2 border-dashed border-gray-600 rounded-xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 hover:from-gray-700/50 hover:to-gray-800/50 transition-all duration-300 backdrop-blur-sm min-w-64 h-32 flex flex-col items-center justify-center gap-3 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/10 transform hover:scale-105"
                >
                    <div className="text-2xl text-blue-400 group-hover:text-blue-300 transition-colors duration-200">
                        <i className="ri-add-circle-line"></i>
                    </div>
                    <span className="text-gray-300 group-hover:text-white font-medium transition-colors duration-200">
                        New Project
                    </span>
                </button>

                {
                    project.map((p) => (
                        <div key={p._id} className="project group flex flex-col gap-3 p-6 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl min-w-64 h-32 hover:from-gray-700 hover:to-gray-800 hover:border-gray-600 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-blue-500/5">
                            <div className="flex justify-between items-start gap-3">
                                <h2 className='font-semibold text-lg text-white group-hover:text-blue-300 transition-colors duration-200 truncate cursor-pointer'
                                    onClick={() => {
                                        navigate(`/project`, {
                                            state: { project: p }
                                        })
                                    }}
                                >
                                    {p.name}
                                </h2>
                                {isOwner(p) && (
                                    <button
                                        onClick={() => deleteProject(p._id)}
                                        className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md transition-all duration-200 shadow border border-red-500/40"
                                        title="Delete project"
                                    >
                                        <i className="ri-delete-bin-6-line"></i>
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-2 mt-auto">
                                <div className="flex items-center gap-1 text-gray-400 group-hover:text-gray-300 transition-colors duration-200">
                                    <i className="ri-user-line text-sm"></i>
                                    <small className="font-medium">Collaborators</small>
                                </div>
                                <span className="text-blue-400 font-semibold bg-blue-400/10 px-2 py-1 rounded-full text-sm">
                                    {p.users.length}
                                </span>
                            </div>
                        </div>
                    ))
                }
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50">
                    <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-2xl shadow-2xl border border-gray-700 w-full max-w-md mx-4">
                        <h2 className="text-2xl font-bold text-white mb-6">Create New Project</h2>
                        <form onSubmit={createProject}>
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Project Name
                                </label>
                                <input
                                    onChange={(e) => setProjectName(e.target.value)}
                                    value={projectName}
                                    type="text" 
                                    className="w-full p-4 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" 
                                    placeholder="Enter project name..."
                                    required 
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button 
                                    type="button" 
                                    className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg font-medium transition-all duration-200 border border-gray-600" 
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium transition-all duration-200 shadow-lg transform hover:scale-105"
                                >
                                    Create Project
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </main>
    )
}

export default Home;