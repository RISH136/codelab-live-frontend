import React, { useState, useEffect, useContext, useRef } from 'react'
import { UserContext } from '../context/user.context'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from '../config/axios'
import { initializeSocket, receiveMessage, sendMessage, offMessage } from '../config/socket'
import Markdown from 'markdown-to-jsx'
import hljs from 'highlight.js';
import { getWebContainer } from '../config/webContainer'


function SyntaxHighlightedCode(props) {
    const ref = useRef(null)

    React.useEffect(() => {
        if (ref.current && props.className?.includes('lang-') && window.hljs) {
            window.hljs.highlightElement(ref.current)

            // hljs won't reprocess the element unless this attribute is removed
            ref.current.removeAttribute('data-highlighted')
        }
    }, [ props.className, props.children ])

    return <code {...props} ref={ref} />
}


const Project = () => {

    const location = useLocation()

    const [ isSidePanelOpen, setIsSidePanelOpen ] = useState(false)
    const [ isModalOpen, setIsModalOpen ] = useState(false)
    const [ selectedUserId, setSelectedUserId ] = useState(new Set()) // Initialized as Set
    const [ selectedRemoveUserId, setSelectedRemoveUserId ] = useState(new Set()) // For removing collaborators
    const [ project, setProject ] = useState(location.state.project)
    const [ message, setMessage ] = useState('')
    const { user, logout } = useContext(UserContext)
    const messageBox = useRef(null)

    const [ users, setUsers ] = useState([])
    const [ messages, setMessages ] = useState([]) // New state variable for messages
    const [ fileTree, setFileTree ] = useState({})

    const [ currentFile, setCurrentFile ] = useState(null)
    const [ openFiles, setOpenFiles ] = useState([])

    const [ webContainer, setWebContainer ] = useState(null)
    const [ iframeUrl, setIframeUrl ] = useState(null)

    const [ runProcess, setRunProcess ] = useState(null)
    const [ isRunning, setIsRunning ] = useState(false)

    const handleUserClick = (id) => {
        setSelectedUserId(prevSelectedUserId => {
            const newSelectedUserId = new Set(prevSelectedUserId);
            if (newSelectedUserId.has(id)) {
                newSelectedUserId.delete(id);
            } else {
                newSelectedUserId.add(id);
            }

            return newSelectedUserId;
        });
    }

    const handleRemoveUserClick = (id) => {
        setSelectedRemoveUserId(prevSelectedRemoveUserId => {
            const newSelectedRemoveUserId = new Set(prevSelectedRemoveUserId);
            if (newSelectedRemoveUserId.has(id)) {
                newSelectedRemoveUserId.delete(id);
            } else {
                newSelectedRemoveUserId.add(id);
            }

            return newSelectedRemoveUserId;
        });
    }


    function addCollaborators() {
        axios.put("/projects/add-user", {
            projectId: location.state.project._id,
            users: Array.from(selectedUserId)
        }).then(res => {
            console.log(res.data)
            setProject(res.data.project) // Update project state
            setIsModalOpen(false)
            setSelectedUserId(new Set()) // Reset selection
        }).catch(err => {
            console.log(err)
        })
    }

    function removeCollaborators() {
        axios.put("/projects/remove-user", {
            projectId: location.state.project._id,
            users: Array.from(selectedRemoveUserId)
        }).then(res => {
            console.log(res.data)
            setProject(res.data.project) // Update project state
            setIsModalOpen(false)
            setSelectedRemoveUserId(new Set()) // Reset selection
        }).catch(err => {
            console.log(err)
        })
    }

    const send = () => {

        sendMessage('project-message', {
            message,
            sender: user
        })
        setMessages(prevMessages => [ ...prevMessages, { sender: user, message } ]) // Update messages state
        setMessage("")

    }

    // Utility function to safely parse AI messages
    function parseAIMessage(messageString) {
        try {
            // First, try to parse as-is
            return JSON.parse(messageString)
        } catch (error) {
            console.log('First parse attempt failed, trying to clean the string...')
            
            try {
                // If it's wrapped in quotes, unwrap it first
                if (messageString.startsWith('"') && messageString.endsWith('"')) {
                    const unwrapped = JSON.parse(messageString)
                    return JSON.parse(unwrapped)
                }
            } catch (secondError) {
                console.log('Second parse attempt failed')
            }
            
            // If all parsing fails, try to extract just the text
            const textMatch = messageString.match(/"text":\s*"([^"]*(?:\\.[^"]*)*)"/)
            if (textMatch) {
                return { text: textMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') }
            }
            
            throw error
        }
    }

    function WriteAiMessage(message) {

        try {
            // Handle both string and object inputs
            let messageObject
            if (typeof message === 'string') {
                messageObject = parseAIMessage(message)
            } else {
                messageObject = message
            }

            return (
                <div
                    className='overflow-auto bg-gray-950 text-white rounded-lg p-4 border border-gray-700 shadow-lg'
                >
                    <Markdown
                        children={messageObject.text}
                        options={{
                            overrides: {
                                code: SyntaxHighlightedCode,
                            },
                        }}
                    />
                </div>)
        } catch (error) {
            console.error('Error parsing AI message in WriteAiMessage:', error)
            console.error('Message content:', message)
            
            return (
                <div className='overflow-auto bg-red-900 text-white rounded-lg p-4 border border-red-700 shadow-lg'>
                    <p>Error displaying AI message: {error.message}</p>
                    <p className='mt-2'>Raw message: {typeof message === 'string' ? message.substring(0, 200) + '...' : JSON.stringify(message)}</p>
                </div>
            )
        }
    }

    useEffect(() => {

        initializeSocket(project._id)

        if (!webContainer) {
            getWebContainer().then(container => {
                setWebContainer(container)
                console.log("container started")
            })
        }


        const onProjectMessage = (data) => {

            console.log(data)
            
            if (data.sender._id == 'ai') {

                try {
                    const message = parseAIMessage(data.message)

                    console.log(message)

                    // Only mount and set fileTree if present (code mode)
                    if (message && message.fileTree) {
                        // Merge using functional update to avoid stale state and persist immediately
                        setFileTree(prevFileTree => {
                            const mergedFileTree = { ...prevFileTree, ...message.fileTree }
                            console.log('Previous fileTree:', prevFileTree)
                            console.log('New fileTree from AI:', message.fileTree)
                            console.log('Merged fileTree:', mergedFileTree)
                            webContainer?.mount(mergedFileTree)
                            saveFileTree(mergedFileTree)
                            return mergedFileTree
                        })
                        // Keep rich AI object when it contains fileTree
                        setMessages(prevMessages => [ ...prevMessages, { ...data, message } ])
                        return
                    }

                    // Chat mode: render as plain text bubble
                    const chatText = message?.text || (typeof data.message === 'string' ? data.message : 'AI response')
                    setMessages(prevMessages => [ ...prevMessages, { ...data, message: chatText } ])
                } catch (error) {
                    console.error('Error parsing AI message:', error)
                    console.error('Raw message:', data.message)
                    
                    // Try to extract just the text content as a fallback
                    try {
                        const fallbackText = data.message.match(/"text":\s*"([^"]+)"/)?.[1] || 
                                           data.message.match(/"text":\s*"([^\"]*(?:\\.[^\"]*)*)"/)?.[1] ||
                                           (typeof data.message === 'string' ? data.message : 'Unable to parse AI response')
                        
                        setMessages(prevMessages => [ ...prevMessages, { 
                            ...data, 
                            message: fallbackText
                        } ])
                    } catch (fallbackError) {
                        // If even the fallback fails, show the raw message
                        const raw = typeof data.message === 'string' ? data.message : JSON.stringify(data.message)
                        setMessages(prevMessages => [ ...prevMessages, { 
                            ...data, 
                            message: raw
                        } ])
                    }
                }
            } else {


                setMessages(prevMessages => [ ...prevMessages, data ]) // Update messages state
            }
        }

        receiveMessage('project-message', onProjectMessage)


        axios.get(`/projects/get-project/${location.state.project._id}`).then(res => {

            console.log(res.data.project)

            setProject(res.data.project)
            setFileTree(res.data.project.fileTree || {})
        })

        axios.get('/users/all').then(res => {

            setUsers(res.data.users)

        }).catch(err => {

            console.log(err)

        })

        return () => {
            offMessage('project-message', onProjectMessage)
        }
    }, [])

    function saveFileTree(ft) {
        axios.put('/projects/update-file-tree', {
            projectId: project._id,
            fileTree: ft
        }).then(res => {
            console.log(res.data)
        }).catch(err => {
            console.log(err)
        })
    }


    // Removed appendIncomingMessage and appendOutgoingMessage functions

    function scrollToBottom() {
        if (messageBox.current) {
            messageBox.current.scrollTop = messageBox.current.scrollHeight
        }
    }

    useEffect(() => {
        // Scroll after new messages render
        requestAnimationFrame(() => {
            scrollToBottom()
        })
    }, [ messages ])

    // Debug fileTree changes
    useEffect(() => {
        console.log('FileTree updated:', fileTree)
        console.log('Current file:', currentFile)
        if (currentFile && fileTree[currentFile]) {
            console.log('Current file content:', fileTree[currentFile])
        }
    }, [fileTree, currentFile])

    

    return (
        <main className='h-screen w-screen flex bg-gray-900 text-white'>
            <section className="left relative flex flex-col h-screen min-w-96 bg-gradient-to-br from-gray-800 to-gray-900 border-r border-gray-700">
                <header className='flex justify-between items-center p-4 w-full bg-gray-800/90 backdrop-blur-sm absolute z-10 top-0 border-b border-gray-700'>
                    <div className="flex gap-3">
                        <button 
                            className='flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105' 
                            onClick={() => setIsModalOpen(true)}
                        >
                            <i className="ri-add-fill text-base"></i>
                            <span>Add Collaborator</span>
                        </button>
                        <button 
                            onClick={() => setIsSidePanelOpen(!isSidePanelOpen)} 
                            className='flex items-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium text-sm transition-all duration-200 shadow-lg border border-gray-600'
                        >
                            <i className="ri-group-fill text-base"></i>
                            <span>Collaborators</span>
                        </button>
                    </div>
                    <button
                        onClick={logout}
                        className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                        <i className="ri-logout-box-r-line text-base"></i>
                        <span>Logout</span>
                    </button>
                </header>
                <div className="conversation-area pt-20 pb-16 flex-grow flex flex-col h-full relative">

                    <div
                        ref={messageBox}
                        className="message-box p-4 flex-grow flex flex-col gap-3 overflow-auto max-h-full scrollbar-hide">
                        {messages.map((msg, index) => (
                            <div key={index} className={`${msg.sender._id === 'ai' ? 'max-w-80' : 'max-w-52'} ${msg.sender._id == user?._id?.toString() && 'ml-auto'}  message flex flex-col p-4 bg-gradient-to-br from-gray-700 to-gray-800 w-fit rounded-xl shadow-lg border border-gray-600`}>
                                <small className='opacity-70 text-xs text-gray-300 mb-1'>{msg.sender.email}</small>
                                <div className='text-sm text-gray-100'>
                                    {msg.sender._id === 'ai'
                                        ? (
                                            // If AI provided a fileTree (code mode), use rich AI rendering; otherwise render like a normal message
                                            msg?.message?.fileTree
                                                ? WriteAiMessage(msg.message)
                                                : <p className="leading-relaxed">{typeof msg.message === 'string' ? msg.message : msg?.message?.text}</p>
                                        )
                                        : <p className="leading-relaxed">{msg.message}</p>}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="inputField w-full flex absolute bottom-0 p-4">
                        <input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className='p-3 px-4 border border-gray-600 bg-gray-800 text-white placeholder-gray-400 rounded-l-lg outline-none flex-grow focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200' type="text" placeholder='Type your message...' />
                        <button
                            onClick={send}
                            className='px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-r-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105'><i className="ri-send-plane-fill text-lg"></i></button>
                    </div>
                </div>
                <div className={`sidePanel w-full h-full flex flex-col gap-2 bg-gray-800 absolute transition-all duration-300 ${isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'} top-0 border-r border-gray-700 shadow-2xl`}>
                    <header className='flex justify-between items-center px-6 p-4 bg-gray-900 border-b border-gray-700'>

                        <h1 className='font-semibold text-xl text-white'>
                            Project Collaborators
                        </h1>

                        <button 
                            onClick={() => setIsSidePanelOpen(!isSidePanelOpen)} 
                            className='p-2 hover:bg-gray-700 rounded-lg transition-all duration-200 text-gray-300 hover:text-white'
                        >
                            <i className="ri-close-fill text-xl"></i>
                        </button>
                    </header>
                    <div className="users flex flex-col gap-2 p-4">

                        {project.users && project.users.map(user => (
                            <div key={user._id} className="user p-4 flex gap-3 items-center rounded-xl hover:bg-gray-700 transition-all duration-200 border border-transparent hover:border-gray-600">
                                <div className='aspect-square rounded-full w-12 h-12 flex items-center justify-center text-white bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg'>
                                    <i className="ri-user-fill text-lg"></i>
                                </div>
                                <div className="flex flex-col">
                                    <span className='font-medium text-white text-base'>{user.email}</span>
                                    <span className='text-sm text-gray-400'>
                                        {user._id === project.users[0]?._id ? 'Owner' : 'Collaborator'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="right bg-gray-900 flex-grow h-full flex">

                <div className="explorer h-full max-w-64 min-w-52 bg-gray-800 border-r border-gray-700">
                    <div className="file-tree w-full">
                        {
                            Object.keys(fileTree).map((file, index) => (
                                <button
                                    key={index}
                                    onClick={() => {
                                        console.log('Clicked file:', file)
                                        console.log('Current fileTree:', fileTree)
                                        console.log('File data:', fileTree[file])
                                        setCurrentFile(file)
                                        setOpenFiles([ ...new Set([ ...openFiles, file ]) ])
                                    }}
                                    className="tree-element cursor-pointer p-4 px-6 flex items-center gap-3 hover:bg-gray-700 w-full border-b border-gray-700 transition-all duration-200 group">
                                    <i className="ri-file-text-line text-blue-400 group-hover:text-blue-300"></i>
                                    <p
                                        className='font-medium text-base text-gray-200 group-hover:text-white transition-colors duration-200'
                                    >{file}</p>
                                </button>))

                        }
                    </div>

                </div>


                <div className="code-editor flex flex-col flex-grow h-full shrink bg-gray-900">

                    <div className="top flex justify-between w-full bg-gray-800 border-b border-gray-700">

                        <div className="files flex">
                            {
                                openFiles.map((file, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setCurrentFile(file)}
                                        className={`open-file cursor-pointer p-3 px-6 flex items-center w-fit gap-3 transition-all duration-200 border-r border-gray-700 ${currentFile === file ? 'bg-gray-900 text-white border-b-2 border-blue-500' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'}`}>
                                        <i className="ri-file-text-line text-sm"></i>
                                        <p
                                            className='font-medium text-base'
                                        >{file}</p>
                                    </button>
                                ))
                            }
                        </div>

                        <div className="actions flex gap-3 p-2">
                            <button
                                onClick={() => {
                                    const proposed = prompt('Enter new file name (e.g., app.js, Project.jsx, package.json)')
                                    if (proposed === null) return
                                    const name = proposed.trim()
                                    if (!name) return
                                    if (fileTree[ name ]) {
                                        alert('A file with that name already exists.')
                                        return
                                    }
                                    const initial = ''
                                    const ft = {
                                        ...fileTree,
                                        [ name ]: { file: { contents: initial } }
                                    }
                                    setFileTree(ft)
                                    saveFileTree(ft)
                                    setCurrentFile(name)
                                    setOpenFiles(prev => [ ...new Set([ ...prev, name ]) ])
                                }}
                                className='px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2'
                            >
                                <i className="ri-file-add-line"></i>
                                New file
                            </button>
                            <button
                                onClick={async () => {
                                    if (isRunning) return; // Prevent multiple clicks
                                    
                                    setIsRunning(true);
                                    try {
                                        // Check if webContainer is available
                                        if (!webContainer) {
                                            throw new Error("Web container is not initialized")
                                        }

                                        // Check if fileTree has content
                                        if (!fileTree || Object.keys(fileTree).length === 0) {
                                            throw new Error("No files to run. Please create some files first.")
                                        }

                                        // Check if package.json exists
                                        if (!fileTree['package.json']) {
                                            throw new Error("No package.json found. Please create a package.json file first.")
                                        }

                                        await webContainer.mount(fileTree)

                                        // Kill any existing process first
                                        if (runProcess) {
                                            runProcess.kill()
                                        }

                                        console.log("Starting npm install...")
                                        const installProcess = await webContainer.spawn("npm", [ "install" ])

                                        // Wait for install process to complete
                                        await new Promise((resolve, reject) => {
                                            let installOutput = []
                                            
                                            installProcess.output.pipeTo(new WritableStream({
                                                write(chunk) {
                                                    console.log("Install:", chunk)
                                                    installOutput.push(chunk)
                                                }
                                            }))

                                            // Set a timeout for the install process
                                            const timeout = setTimeout(() => {
                                                reject(new Error("npm install timed out after 60 seconds"))
                                            }, 60000)

                                            installProcess.exit.then(({ code }) => {
                                                clearTimeout(timeout)
                                                console.log("Install process exited with code:", code)
                                                
                                                if (code === 0 || code === undefined) {
                                                    console.log("npm install completed successfully")
                                                    resolve()
                                                } else {
                                                    console.error("npm install failed with code:", code)
                                                    console.error("Install output:", installOutput.join(''))
                                                    reject(new Error(`npm install failed with code: ${code}`))
                                                }
                                            }).catch((error) => {
                                                clearTimeout(timeout)
                                                console.error("Install process error:", error)
                                                reject(error)
                                            })
                                        })

                                        console.log("Starting npm start...")
                                        let tempRunProcess = await webContainer.spawn("npm", [ "start" ]);

                                        tempRunProcess.output.pipeTo(new WritableStream({
                                            write(chunk) {
                                                console.log("Start:", chunk)
                                            }
                                        }))

                                        setRunProcess(tempRunProcess)

                                        // Set up server-ready listener
                                        const serverReadyHandler = (port, url) => {
                                            console.log("Server ready on port:", port, "URL:", url)
                                            setIframeUrl(url)
                                        }
                                        
                                        webContainer.on('server-ready', serverReadyHandler)

                                        // Handle process exit
                                        tempRunProcess.exit.then(({ code }) => {
                                            console.log("Start process exited with code:", code)
                                            if (code !== 0 && code !== undefined) {
                                                console.error("Application failed to start properly")
                                            }
                                        }).catch((error) => {
                                            console.error("Start process error:", error)
                                        })

                                    } catch (error) {
                                        console.error("Error running application:", error)
                                        alert(`Error running application: ${error.message}`)
                                    } finally {
                                        setIsRunning(false);
                                    }
                                }}
                                disabled={isRunning}
                                className={`px-6 py-2 ${isRunning ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2`}
                            >
                                <i className={isRunning ? "ri-loader-4-line animate-spin" : "ri-play-fill"}></i>
                                {isRunning ? 'Running...' : 'Run'}
                            </button>

                            <button
                                onClick={() => {
                                    if (!currentFile) return;
                                    const confirmDelete = confirm(`Delete file "${currentFile}"?`)
                                    if (!confirmDelete) return

                                    const { [ currentFile ]: _deleted, ...rest } = fileTree
                                    setFileTree(rest)
                                    saveFileTree(rest)

                                    setOpenFiles(prev => prev.filter(f => f !== currentFile))

                                    const remaining = Object.keys(rest)
                                    setCurrentFile(remaining.length ? remaining[0] : null)
                                }}
                                disabled={!currentFile}
                                className={`px-6 py-2 ${!currentFile ? 'bg-gray-600 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'} text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2`}
                            >
                                <i className="ri-delete-bin-6-line"></i>
                                Delete file
                            </button>


                        </div>
                    </div>
                    <div className="bottom flex flex-grow max-w-full shrink overflow-auto">
                        {
                            fileTree[ currentFile ] && (
                                <div className="code-editor-area h-full overflow-auto flex-grow bg-gray-900">
                                    <pre
                                        className="hljs h-full bg-gray-900">
                                        <code
                                            className="hljs h-full outline-none text-gray-100 bg-gray-900"
                                            contentEditable
                                            suppressContentEditableWarning
                                            onBlur={(e) => {
                                                const updatedContent = e.target.innerText;
                                                const ft = {
                                                    ...fileTree,
                                                    [ currentFile ]: {
                                                        file: {
                                                            contents: updatedContent
                                                        }
                                                    }
                                                }
                                                setFileTree(ft)
                                                saveFileTree(ft)
                                            }}
                                            dangerouslySetInnerHTML={{ __html: hljs.highlight('javascript', fileTree[ currentFile ]?.file?.contents || '').value }}
                                            style={{
                                                whiteSpace: 'pre-wrap',
                                                paddingBottom: '25rem',
                                                counterSet: 'line-numbering',
                                                padding: '1.5rem',
                                                lineHeight: '1.6'
                                            }}
                                        />
                                    </pre>
                                </div>
                            )
                        }
                    </div>

                </div>

                {iframeUrl && webContainer &&
                    (<div className="flex min-w-96 flex-col h-full border-l border-gray-700">
                        <div className="address-bar bg-gray-800 border-b border-gray-700">
                            <input type="text"
                                onChange={(e) => setIframeUrl(e.target.value)}
                                value={iframeUrl} className="w-full p-3 px-4 bg-gray-800 text-white placeholder-gray-400 border-none outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter URL..." />
                        </div>
                        <iframe src={iframeUrl} className="w-full h-full bg-white"></iframe>
                    </div>)
                }


            </section>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-2xl w-[500px] max-w-full relative shadow-2xl border border-gray-700">
                        <header className='flex justify-between items-center mb-8'>
                            <h2 className='text-2xl font-bold text-white'>Manage Collaborators</h2>
                            <button 
                                onClick={() => {
                                    setIsModalOpen(false);
                                    setSelectedUserId(new Set());
                                    setSelectedRemoveUserId(new Set());
                                }} 
                                className='p-2 hover:bg-gray-700 rounded-lg transition-all duration-200 text-gray-400 hover:text-white'
                            >
                                <i className="ri-close-fill text-xl"></i>
                            </button>
                        </header>
                        
                        {/* Add Collaborators Section */}
                        <div className="mb-8">
                            <h3 className="text-lg font-semibold mb-4 text-green-400 flex items-center gap-2">
                                <i className="ri-user-add-line"></i>
                                Add Collaborators
                            </h3>
                            <div className="users-list flex flex-col gap-2 mb-4 max-h-48 overflow-auto border border-gray-600 rounded-xl p-3 bg-gray-800/50">
                                {users.filter(user => !project.users?.some(projectUser => projectUser._id === user._id)).map(user => (
                                    <div 
                                        key={user._id} 
                                        className={`user cursor-pointer hover:bg-gray-700 rounded-lg p-3 flex gap-3 items-center transition-all duration-200 ${
                                            Array.from(selectedUserId).indexOf(user._id) !== -1 ? 'bg-blue-600/20 border border-blue-500' : "border border-transparent hover:border-gray-600"
                                        }`} 
                                        onClick={() => handleUserClick(user._id)}
                                    >
                                        <div className='aspect-square rounded-full w-10 h-10 flex items-center justify-center text-white bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg'>
                                            <i className="ri-user-fill text-sm"></i>
                                        </div>
                                        <span className='font-medium text-white'>{user.email}</span>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={addCollaborators}
                                disabled={selectedUserId.size === 0}
                                className='w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl'
                            >
                                Add Users ({selectedUserId.size})
                            </button>
                        </div>

                        {/* Remove Collaborators Section */}
                        <div className="mb-4">
                            <h3 className="text-lg font-semibold mb-4 text-red-400 flex items-center gap-2">
                                <i className="ri-user-unfollow-line"></i>
                                Remove Collaborators
                            </h3>
                            <div className="users-list flex flex-col gap-2 mb-4 max-h-48 overflow-auto border border-gray-600 rounded-xl p-3 bg-gray-800/50">
                                {project.users?.filter(projectUser => projectUser._id !== user._id).map(projectUser => (
                                    <div 
                                        key={projectUser._id} 
                                        className={`user cursor-pointer hover:bg-gray-700 rounded-lg p-3 flex gap-3 items-center transition-all duration-200 ${
                                            Array.from(selectedRemoveUserId).indexOf(projectUser._id) !== -1 ? 'bg-red-600/20 border border-red-500' : "border border-transparent hover:border-gray-600"
                                        }`} 
                                        onClick={() => handleRemoveUserClick(projectUser._id)}
                                    >
                                        <div className='aspect-square rounded-full w-10 h-10 flex items-center justify-center text-white bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg'>
                                            <i className="ri-user-fill text-sm"></i>
                                        </div>
                                        <span className='font-medium text-white'>{projectUser.email}</span>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={removeCollaborators}
                                disabled={selectedRemoveUserId.size === 0}
                                className='w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl'
                            >
                                Remove Users ({selectedRemoveUserId.size})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}

export default Project

